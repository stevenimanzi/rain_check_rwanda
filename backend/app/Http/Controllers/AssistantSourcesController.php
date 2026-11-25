<?php

namespace App\Http\Controllers;

use App\Services\AssistantSources;
use Illuminate\Http\JsonResponse;

/**
 * Details of the data sources behind the assistant's answers, for the "Data from" dialog in the chat.
 */
class AssistantSourcesController extends Controller
{
    public function __invoke(AssistantSources $sources): JsonResponse
    {
        return response()->json(['data' => $sources->all()]);
    }
}
