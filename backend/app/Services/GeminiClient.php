<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Sends a conversation to Google's Gemini models. The API key stays on the server.
 * When a model is retired or busy, the next one is tried, so one overloaded model does not take the feature down.
 */
class GeminiClient
{
    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array{text: ?string, finish_reason: ?string, status: int} text is null when every model failed
     */
    public function generate(string $system, array $messages, float $temperature = 0.2, int $maxTokens = 3000): array
    {
        $key = config('services.google.key');

        $body = [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => array_map(
                fn (array $message) => [
                    'role' => $message['role'] === 'assistant' ? 'model' : 'user',
                    'parts' => [['text' => $message['content']]],
                ],
                $messages,
            ),
            'generationConfig' => ['maxOutputTokens' => $maxTokens, 'temperature' => $temperature],
        ];

        // A CA bundle path copied from another machine must not break HTTPS on this one.
        $caBundle = config('services.google.ca_bundle');
        $verify = $caBundle && is_file($caBundle) ? $caBundle : true;

        $status = 0;
        $startedAt = microtime(true);

        foreach ($this->models() as $model) {
            // Stay inside the host's request time limit.
            if (microtime(true) - $startedAt > 70) {
                break;
            }

            try {
                $response = Http::withHeaders(['x-goog-api-key' => $key])
                    ->withOptions(['verify' => $verify])
                    ->timeout(60)
                    // A busy model (500/503) usually answers on a short retry. A 429 means this key's quota for that
                    // model is used up, so waiting does not help: go straight to the next model.
                    ->retry(2, 1000, fn ($e) => in_array($e->response?->status(), [500, 503], true), throw: false)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", $body);
            } catch (Throwable $e) {
                report($e);
                $status = 0;

                continue;
            }

            if ($response->successful()) {
                $payload = $response->json();
                $parts = $payload['candidates'][0]['content']['parts'] ?? [];

                return [
                    'text' => trim(implode('', array_map(fn (array $part) => (string) ($part['text'] ?? ''), $parts))),
                    'finish_reason' => $payload['candidates'][0]['finishReason'] ?? null,
                    'status' => 200,
                ];
            }

            $status = $response->status();
            report(new \RuntimeException("Google AI request failed for {$model}: {$status} ".$response->body()));

            // A rejected key or a malformed request will not improve with another model.
            if (in_array($status, [400, 401, 403], true)) {
                break;
            }
        }

        return ['text' => null, 'finish_reason' => null, 'status' => $status];
    }

    /** The configured model, then fallbacks. */
    private function models(): array
    {
        return array_values(array_unique(array_filter([
            config('services.google.model'),
            'gemini-3.5-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.6-flash',
        ])));
    }
}
