<?php

namespace Tests\Unit;

use App\Services\ChirpsGrid;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Tests\Support\FakeChirpsMap;

class ChirpsGridTest extends TestCase
{
    /** Two rows of four cells; the cells cover longitude 28 to 30 and latitude 0 to -1. */
    private const ROWS = [[10.0, 20.0, 30.0, -9999.0], [50.0, 60.0, 70.0, 80.0]];

    private function square(float $west, float $south, float $east, float $north): array
    {
        return ['type' => 'Polygon', 'coordinates' => [[
            [$west, $south], [$east, $south], [$east, $north], [$west, $north], [$west, $south],
        ]]];
    }

    public static function compressions(): array
    {
        return ['uncompressed' => [1], 'LZW' => [5], 'deflate' => [8]];
    }

    #[DataProvider('compressions')]
    public function test_it_averages_every_cell_the_district_touches(int $compression): void
    {
        $grid = new ChirpsGrid(FakeChirpsMap::build(self::ROWS, $compression));

        // Reaches slightly into two columns of both rows: 10, 20, 50 and 60.
        $this->assertEqualsWithDelta(35.0, $grid->meanInside($this->square(28.4, -0.6, 28.6, -0.4)), 0.001);
    }

    public function test_it_ignores_cells_without_data_and_cells_that_only_share_an_edge(): void
    {
        $grid = new ChirpsGrid(FakeChirpsMap::build(self::ROWS));

        // Exactly the top two eastern cells; one of them has no data.
        $this->assertEqualsWithDelta(30.0, $grid->meanInside($this->square(29.0, -0.5, 30.0, 0.0)), 0.001);
    }

    public function test_it_returns_null_outside_the_map(): void
    {
        $grid = new ChirpsGrid(FakeChirpsMap::build(self::ROWS));

        $this->assertNull($grid->meanInside($this->square(40.0, -5.0, 41.0, -4.0)));
    }

    public function test_it_refuses_a_file_that_is_not_a_map(): void
    {
        $this->expectException(RuntimeException::class);

        new ChirpsGrid('<html>not found</html>');
    }
}
