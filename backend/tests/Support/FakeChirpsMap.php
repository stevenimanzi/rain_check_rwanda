<?php

namespace Tests\Support;

/**
 * A tiny GeoTIFF laid out like a CHIRPS map: one row per strip, 32-bit floating point values.
 * The grid starts at longitude 28, latitude 0, with cells of half a degree.
 */
class FakeChirpsMap
{
    /**
     * @param  array<int, array<int, float>>  $rows  values from north to south, west to east
     * @param  int  $compression  1 none, 5 LZW, 8 deflate
     */
    public static function build(array $rows, int $compression = 5): string
    {
        $strips = array_map(function (array $row) use ($compression) {
            $raw = pack('g*', ...$row);

            return match ($compression) {
                5 => self::lzw($raw),
                8 => gzcompress($raw),
                default => $raw,
            };
        }, $rows);

        $body = '';
        $offsets = [];
        $counts = [];

        foreach ($strips as $strip) {
            $offsets[] = 8 + strlen($body);
            $counts[] = strlen($strip);
            $body .= $strip;
        }

        // Like a real map: the cell values first, then the index, then the tables the index points to.
        $indexAt = 8 + strlen($body);
        $extra = '';
        $extraAt = $indexAt + 2 + 11 * 12 + 4;
        $store = function (string $bytes) use (&$extra, $extraAt) {
            $at = $extraAt + strlen($extra);
            $extra .= $bytes;

            return $at;
        };
        $height = count($rows);
        $entries = [
            [256, 3, 1, count($rows[0])],
            [257, 3, 1, $height],
            [258, 3, 1, 32],
            [259, 3, 1, $compression],
            [273, 4, $height, $height === 1 ? $offsets[0] : $store(pack('V*', ...$offsets))],
            [277, 3, 1, 1],
            [278, 3, 1, 1],
            [279, 4, $height, $height === 1 ? $counts[0] : $store(pack('V*', ...$counts))],
            [339, 3, 1, 3],
            [33550, 12, 3, $store(pack('e*', 0.5, 0.5, 0.0))],
            [33922, 12, 6, $store(pack('e*', 0.0, 0.0, 0.0, 28.0, 0.0, 0.0))],
        ];

        $directory = pack('v', count($entries));

        foreach ($entries as [$tag, $type, $count, $value]) {
            $directory .= pack('vvVV', $tag, $type, $count, $value);
        }

        $directory .= pack('V', 0);

        return 'II'.pack('vV', 42, $indexAt).$body.$directory.$extra;
    }

    /** A valid, very plain LZW stream: single bytes only, restarting the table before codes would widen. */
    private static function lzw(string $data): string
    {
        $codes = [];

        foreach (str_split($data, 200) as $chunk) {
            $codes[] = 256;
            array_push($codes, ...array_values(unpack('C*', $chunk)));
        }

        $codes[] = 257;
        $bits = implode('', array_map(fn (int $code) => str_pad(decbin($code), 9, '0', STR_PAD_LEFT), $codes));

        return implode('', array_map(
            fn (string $byte) => chr(bindec(str_pad($byte, 8, '0'))),
            str_split($bits, 8),
        ));
    }
}
