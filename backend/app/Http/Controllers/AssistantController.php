<?php

namespace App\Http\Controllers;

use AiProvider\Client;
use App\Services\DistrictAnalysis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Chat assistant that answers questions about the RainCheck Rwanda results.
 * The API key stays on the server; the browser only ever talks to this endpoint.
 */
class AssistantController extends Controller
{
    public function __invoke(Request $request, DistrictAnalysis $analysis): JsonResponse
    {
        $key = config('services.aiprovider.key');

        if (! $key) {
            return response()->json(['message' => 'The AI assistant is not switched on yet.'], 503);
        }

        $data = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:20'],
            'messages.*.role' => ['required', 'in:user,assistant'],
            'messages.*.content' => ['required', 'string', 'max:2000'],
        ]);

        $messages = array_map(
            fn (array $m) => ['role' => $m['role'], 'content' => $m['content']],
            $data['messages'],
        );

        if (end($messages)['role'] !== 'user') {
            return response()->json(['message' => 'The last message must be from the user.'], 422);
        }

        try {
            $client = new Client(apiKey: $key);

            $reply = $client->messages->create(
                model: config('services.aiprovider.model'),
                maxTokens: 1500,
                system: [
                    [
                        'type' => 'text',
                        'text' => $this->systemPrompt($analysis),
                        'cacheControl' => ['type' => 'ephemeral'],
                    ],
                ],
                messages: $messages,
                outputConfig: ['effort' => 'low'],
            );
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => 'The assistant could not answer right now. Please try again.'], 502);
        }

        if ($reply->stopReason === 'refusal') {
            return response()->json(['reply' => 'I cannot help with that request. Please ask about the RainCheck Rwanda data.']);
        }

        $text = '';
        foreach ($reply->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }

        return response()->json(['reply' => trim($text) ?: 'I could not find an answer. Please rephrase your question.']);
    }

    /**
     * Everything the assistant knows: the method, the limits and one row per district.
     * It is built from the database on each request, so it always matches the dashboard.
     */
    private function systemPrompt(DistrictAnalysis $analysis): string
    {
        $districts = $analysis->all();
        $correlation = $analysis->rankCorrelation($districts);

        $rows = $districts->map(fn (array $d) => implode(' | ', [
            $d['name'],
            $d['province'],
            'households reporting drought: '.($d['household_drought_pct'] ?? 'n/a').'%',
            'satellite dry months (Apr 2023-Mar 2024): '.$d['summary']['satellite_drought_months'],
            'average dry months a year: '.$d['summary']['avg_dry_months_per_year'],
            'satellite score: '.($d['summary']['satellite_rank_pct'] ?? 'n/a'),
            'household score: '.($d['summary']['household_rank_pct'] ?? 'n/a'),
            'gap: '.($d['summary']['basis_risk_pct'] ?? 'n/a').' points',
            'mismatch risk: '.$d['summary']['risk_level'],
            'direction: '.($d['summary']['direction'] ?? 'n/a'),
        ]))->implode("\n");

        $deficit = config('raincheck.rainfall_deficit_threshold');
        $minimum = config('raincheck.minimum_normal_mm');
        $medium = config('raincheck.basis_risk_medium');
        $high = config('raincheck.basis_risk_high');

        return <<<PROMPT
You are the assistant inside RainCheck Rwanda, a dashboard built for the NISR 2026 Big Data Hackathon.
You help insurers, ministries, lenders and students understand the results. Write in short, simple English
that a non-expert can follow. Use plain text only: no markdown, no bullet symbols, no bold. Keep answers
under 150 words unless the user asks for more.

What the project asks: does satellite rainfall match the droughts Rwandan households report? Index-based
crop insurance pays when satellite rainfall is low, not when a farm loses its crop. When the satellite and
the farmers disagree, a farmer can lose a harvest and get nothing, or the insurer pays when nothing
happened. This gap is called mismatch risk (also called basis risk).

How the numbers are made:
- Rainfall: CHIRPS v3 satellite rainfall, monthly, 2014 to 2024, averaged over each district.
- Normal rainfall for a calendar month is the median of that month in the other years.
- A dry month is a month with {$deficit}% or more less rain than normal. Months that normally get under {$minimum} mm (June to August) are not judged.
- Households that reported drought: NISR and WFP, Rwanda CFSVA 2024. The district values were measured from a published chart, so they can be off by about 1 percentage point.
- Comparison period: April 2023 to March 2024, the 12 months households were asked about.
- Each district gets a satellite score and a household score from 0 (lowest of the 30 districts) to 100 (highest). The gap between the two scores is the mismatch risk: under {$medium} points is low, {$medium} up to {$high} is medium, and {$high} or more is high.
- Rank correlation between the two scores across the districts: {$correlation} (1 is a perfect match, 0 is no relationship).

Limits you must be honest about: satellite rain is an estimate on a 5 km grid, not a farm measurement; household answers are self-reported; dry spells shorter than a month are not visible; only one year of household data; a dry month is not the same as crop loss.

District data (one line per district):
{$rows}

Rules:
- Answer only from this information. If the data does not contain the answer, say so and do not guess.
- Never invent numbers. Quote the numbers above exactly.
- You may explain terms such as median, basis risk or index insurance in simple words.
- Do not give personalised financial or investment advice. If asked, explain that you describe the data and are not a licensed advisor.
- If the question is not about this project, rainfall, drought, insurance or the data, politely say you can only help with RainCheck Rwanda.
PROMPT;
    }
}
