<?php

namespace App\Services;

use Closure;
use RuntimeException;

/**
 * Reads one CHIRPS monthly rainfall map (a GeoTIFF) and averages the rain inside each district.
 *
 * Only what CHIRPS files use is supported: one band of 32-bit floating point numbers stored in strips,
 * uncompressed, LZW or deflate, without a predictor. Anything else is refused rather than misread.
 * The averaging matches data-tools/chirps_to_csv.py: every grid cell a district touches counts once.
 *
 * The file can be given whole, or as a function that reads part of it, so only the parts that are needed
 * have to be downloaded.
 */
class ChirpsGrid
{
    /** How much to read where the file's index starts; the index and its tables follow each other. */
    private const INDEX_BYTES = 65536;

    /** @var Closure(int, int): string */
    private Closure $source;

    /** @var array<int, string> parts of the file already read, by their position */
    private array $parts = [];

    private bool $little;

    /** @var array<int, array<int, int|float>> tag => values */
    private array $tags = [];

    /** @var array<int, array<int, float>> decoded rows, by row number */
    private array $rows = [];

    /**
     * @param  string|Closure(int, int): string  $source  the file's contents, or a function that returns the bytes
     *                                                    at a position (fewer when the file ends first)
     */
    public function __construct(string|Closure $source)
    {
        $this->source = $source instanceof Closure
            ? $source
            : fn (int $offset, int $length) => substr($source, $offset, $length);
        $header = $this->read(0, 8);
        $order = substr($header, 0, 2);

        if (strlen($header) < 8 || ! in_array($order, ['II', 'MM'], true)) {
            throw new RuntimeException('The satellite file is not a TIFF map.');
        }

        $this->little = $order === 'II';

        if ($this->short(2) !== 42) {
            throw new RuntimeException('The satellite file uses a TIFF layout that is not supported.');
        }

        $index = $this->long(4);
        $this->read($index, self::INDEX_BYTES);
        $this->readTags($index);

        if (isset($this->tags[322])
            || ($this->tag(258) ?? 0) !== 32
            || ($this->tag(339) ?? 1) !== 3
            || ($this->tag(277) ?? 1) !== 1
            || ($this->tag(317) ?? 1) !== 1
            || ! in_array($this->tag(259) ?? 1, [1, 5, 8, 32946], true)
            || ! isset($this->tags[273], $this->tags[279], $this->tags[33550], $this->tags[33922])) {
            throw new RuntimeException('The satellite file format has changed and cannot be read safely.');
        }
    }

    /**
     * Reads, in one go, every row that any of these outlines reaches.
     *
     * @param  array<array>  $geometries
     */
    public function preload(array $geometries): void
    {
        $rows = [];

        foreach ($geometries as $geometry) {
            [, , $firstRow, $lastRow] = $this->cellRange($this->rings($geometry));

            if ($firstRow <= $lastRow) {
                array_push($rows, $firstRow, $lastRow);
            }
        }

        if (! $rows) {
            return;
        }

        $start = (int) $this->tags[273][$this->strip(min($rows))];
        $last = $this->strip(max($rows));
        $this->read($start, (int) $this->tags[273][$last] + (int) $this->tags[279][$last] - $start);
    }

    /**
     * Average rainfall inside a GeoJSON Polygon or MultiPolygon, or null when no grid cell has a value.
     */
    public function meanInside(array $geometry): ?float
    {
        $rings = $this->rings($geometry);
        [$firstColumn, $lastColumn, $firstRow, $lastRow] = $this->cellRange($rings);
        [$sizeX, $sizeY, $originX, $originY] = $this->grid();

        $sum = 0.0;
        $count = 0;

        for ($row = $firstRow; $row <= $lastRow; $row++) {
            $values = $this->row($row);
            $top = $originY - $row * $sizeY;
            $bottom = $top - $sizeY;

            for ($column = $firstColumn; $column <= $lastColumn; $column++) {
                $left = $originX + $column * $sizeX;
                $value = $values[$column];

                // Negative values mark cells without data (sea, lakes outside the product).
                if ($value < 0 || ! $this->touches($rings, $left, $bottom, $left + $sizeX, $top)) {
                    continue;
                }

                $sum += $value;
                $count++;
            }
        }

        return $count ? $sum / $count : null;
    }

    private function rings(array $geometry): array
    {
        $polygons = $geometry['type'] === 'MultiPolygon' ? $geometry['coordinates'] : [$geometry['coordinates']];

        return array_merge(...$polygons);
    }

    /** @return array{0: float, 1: float, 2: float, 3: float} cell width and height, then the top-left corner */
    private function grid(): array
    {
        // The tie point places the top-left corner of the first cell.
        return [$this->tags[33550][0], $this->tags[33550][1], $this->tags[33922][3], $this->tags[33922][4]];
    }

    /** @return array{0: int, 1: int, 2: int, 3: int} first and last column, first and last row around the rings */
    private function cellRange(array $rings): array
    {
        $points = array_merge(...$rings);
        $xs = array_column($points, 0);
        $ys = array_column($points, 1);
        [$sizeX, $sizeY, $originX, $originY] = $this->grid();

        return [
            max(0, (int) floor((min($xs) - $originX) / $sizeX)),
            min($this->tag(256) - 1, (int) floor((max($xs) - $originX) / $sizeX)),
            max(0, (int) floor(($originY - max($ys)) / $sizeY)),
            min($this->tag(257) - 1, (int) floor(($originY - min($ys)) / $sizeY)),
        ];
    }

    /** Whether a grid cell and a district overlap: an edge crosses the cell, or the cell's centre is inside. */
    private function touches(array $rings, float $left, float $bottom, float $right, float $top): bool
    {
        $x = ($left + $right) / 2;
        $y = ($bottom + $top) / 2;
        $inside = false;

        foreach ($rings as $ring) {
            $last = count($ring) - 1;

            for ($i = 0, $j = $last; $i <= $last; $j = $i++) {
                [$x1, $y1] = $ring[$j];
                [$x2, $y2] = $ring[$i];

                if ($this->segmentCrosses($x1, $y1, $x2, $y2, $left, $bottom, $right, $top)) {
                    return true;
                }

                if (($y1 > $y) !== ($y2 > $y) && $x < ($x2 - $x1) * ($y - $y1) / ($y2 - $y1) + $x1) {
                    $inside = ! $inside;
                }
            }
        }

        return $inside;
    }

    /** Liang-Barsky test: does part of the line from (x1, y1) to (x2, y2) lie inside the rectangle? */
    private function segmentCrosses(float $x1, float $y1, float $x2, float $y2, float $left, float $bottom, float $right, float $top): bool
    {
        if (max($x1, $x2) <= $left || min($x1, $x2) >= $right || max($y1, $y2) <= $bottom || min($y1, $y2) >= $top) {
            return false;
        }

        $dx = $x2 - $x1;
        $dy = $y2 - $y1;
        $enter = 0.0;
        $leave = 1.0;

        foreach ([[-$dx, $x1 - $left], [$dx, $right - $x1], [-$dy, $y1 - $bottom], [$dy, $top - $y1]] as [$p, $q]) {
            if ($p == 0) {
                if ($q < 0) {
                    return false;
                }

                continue;
            }

            $t = $q / $p;

            if ($p < 0) {
                $enter = max($enter, $t);
            } else {
                $leave = min($leave, $t);
            }
        }

        return $enter < $leave;
    }

    /** @return array<int, float> the values of one row of the grid */
    private function row(int $row): array
    {
        if (! isset($this->rows[$row])) {
            $strip = $this->strip($row);
            $data = $this->read((int) $this->tags[273][$strip], (int) $this->tags[279][$strip]);

            $data = match ($this->tag(259) ?? 1) {
                5 => $this->unpackLzw($data),
                8, 32946 => (string) gzuncompress($data),
                default => $data,
            };

            $width = $this->tag(256);

            if (strlen($data) < $width * 4) {
                throw new RuntimeException('The satellite file is incomplete.');
            }

            foreach (str_split($data, $width * 4) as $offset => $line) {
                if (strlen($line) === $width * 4) {
                    $this->rows[$strip * $this->rowsPerStrip() + $offset] = array_values(unpack(($this->little ? 'g' : 'G').'*', $line));
                }
            }
        }

        return $this->rows[$row];
    }

    private function rowsPerStrip(): int
    {
        return min($this->tag(278) ?? $this->tag(257), $this->tag(257));
    }

    private function strip(int $row): int
    {
        return intdiv($row, $this->rowsPerStrip());
    }

    /** TIFF flavour of LZW: codes are read high bit first and grow one step early. */
    private function unpackLzw(string $data): string
    {
        $base = [];
        for ($i = 0; $i < 256; $i++) {
            $base[] = chr($i);
        }
        $base[] = ''; // 256: start the table again
        $base[] = ''; // 257: end of data

        $table = $base;
        $width = 9;
        $buffer = 0;
        $held = 0;
        $previous = null;
        $out = '';
        $length = strlen($data);

        for ($i = 0; $i < $length; $i++) {
            $buffer = (($buffer << 8) | ord($data[$i])) & 0xFFFFFF;
            $held += 8;

            while ($held >= $width) {
                $code = ($buffer >> ($held - $width)) & ((1 << $width) - 1);
                $held -= $width;

                if ($code === 257) {
                    return $out;
                }

                if ($code === 256) {
                    $table = $base;
                    $width = 9;
                    $previous = null;

                    continue;
                }

                if ($previous === null) {
                    $entry = $table[$code] ?? throw new RuntimeException('The satellite file is damaged.');
                } else {
                    if ($code > count($table)) {
                        throw new RuntimeException('The satellite file is damaged.');
                    }

                    $entry = $code < count($table) ? $table[$code] : $previous.$previous[0];
                    $table[] = $previous.$entry[0];
                }

                $out .= $entry;
                $previous = $entry;

                if (count($table) >= (1 << $width) - 1 && $width < 12) {
                    $width++;
                }
            }
        }

        return $out;
    }

    private function readTags(int $offset): void
    {
        // Bytes per value, by TIFF field type.
        $sizes = [1 => 1, 2 => 1, 3 => 2, 4 => 4, 12 => 8];
        $entries = $this->short($offset);

        for ($i = 0; $i < $entries; $i++) {
            $at = $offset + 2 + $i * 12;
            $tag = $this->short($at);
            $type = $this->short($at + 2);
            $count = $this->long($at + 4);

            if (! isset($sizes[$type]) || $type === 2) {
                continue;
            }

            $total = $sizes[$type] * $count;
            // Small values sit in the entry itself, larger ones elsewhere in the file.
            $start = $total <= 4 ? $at + 8 : $this->long($at + 8);
            $format = match ($type) {
                1 => 'C',
                3 => $this->little ? 'v' : 'n',
                4 => $this->little ? 'V' : 'N',
                12 => $this->little ? 'e' : 'E',
            };

            $values = $this->read($start, $total);

            if (strlen($values) < $total) {
                throw new RuntimeException('The satellite file is incomplete.');
            }

            $this->tags[$tag] = array_values(unpack($format.$count, $values));
        }
    }

    private function tag(int $tag): ?int
    {
        return isset($this->tags[$tag]) ? (int) $this->tags[$tag][0] : null;
    }

    private function short(int $offset): int
    {
        return $this->number($offset, 2, $this->little ? 'v' : 'n');
    }

    private function long(int $offset): int
    {
        return $this->number($offset, 4, $this->little ? 'V' : 'N');
    }

    private function number(int $offset, int $size, string $format): int
    {
        $bytes = $this->read($offset, $size);

        if (strlen($bytes) < $size) {
            throw new RuntimeException('The satellite file is incomplete.');
        }

        return unpack($format, $bytes)[1];
    }

    /** Bytes of the file, taken from a part that was already read when it holds all of them. */
    private function read(int $offset, int $length): string
    {
        foreach ($this->parts as $start => $part) {
            if ($offset >= $start && $offset + $length <= $start + strlen($part)) {
                return substr($part, $offset - $start, $length);
            }
        }

        return $this->parts[$offset] = ($this->source)($offset, $length);
    }
}
