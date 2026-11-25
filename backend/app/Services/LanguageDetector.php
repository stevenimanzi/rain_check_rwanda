<?php

namespace App\Services;

class LanguageDetector
{
    /** Words that almost only appear in Kinyarwanda. One is enough. */
    private const STRONG = [
        'mbwira', 'mumbwire', 'mpa', 'mpe', 'sobanura', 'mpamba', 'murakoze', 'murabeho', 'muraho', 'mwaramutse',
        'mwiriwe', 'amakuru', 'ndashaka', 'nshaka', 'ndifuza', 'kuki', 'ubuhe', 'ibihe', 'ingahe', 'bingahe',
        'angahe', 'zingahe', 'ryari', 'uturere', 'akarere', 'intara', 'imvura', 'amapfa', 'izuba', 'ubutaka',
        'abaturage', 'ingo', 'ubwishingizi', 'ibiza', 'itandukaniro', 'ikigereranyo', 'igihe', 'uko', 'ubwoko',
        'nta', 'ntabwo', 'nibyo', 'oya', 'yego', 'birahagije', 'ibyo', 'iyi', 'aya', 'izi', 'iki', 'ikihe',
        'ubuhinzi', 'umusaruro', 'abahinzi', 'umuhinzi', 'ukwezi', 'amezi', 'umwaka', 'myaka', 'cyogajuru',
        'hehe', 'iyihe', 'ayahe', 'ahahe', 'gatanu', 'kabiri', 'gatatu',
    ];

    /** Short words common in Kinyarwanda but also found in other languages. Two are needed. */
    private const WEAK = [
        'ni', 'mu', 'ko', 'ku', 'cyane', 'cyangwa', 'ariko', 'kandi', 'bya', 'za', 'wa', 'ba',
        'nka', 'ryo', 'rya', 'hose', 'hari', 'afite', 'ufite', 'bafite', 'kurusha',
    ];

    public function isKinyarwanda(string $text): bool
    {
        $words = preg_split('/[^\p{L}]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if ($words === []) {
            return false;
        }

        $strong = count(array_intersect($words, self::STRONG));
        $weak = count(array_intersect($words, self::WEAK));

        // A mixed question such as "Ni iki mismatch risk?" has few clue words, so a lot of weak ones count too.
        return $strong >= 1 || $weak >= 2;
    }
}
