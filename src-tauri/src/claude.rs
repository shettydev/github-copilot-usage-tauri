use reqwest::header::HeaderMap;
use serde::Serialize;

const ANTHROPIC_MODELS_URL: &str = "https://api.anthropic.com/v1/models";
const ANTHROPIC_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Debug, Serialize)]
pub struct ClaudeRateLimitSnapshot {
    pub input_tokens_used: u64,
    pub output_tokens_used: u64,
    pub cache_creation_tokens_used: u64,
    pub cache_read_tokens_used: u64,
    pub requests_limit: Option<u64>,
    pub requests_remaining: Option<u64>,
    pub requests_reset: Option<String>,
    pub input_tokens_limit: Option<u64>,
    pub input_tokens_remaining: Option<u64>,
    pub input_tokens_reset: Option<String>,
    pub output_tokens_limit: Option<u64>,
    pub output_tokens_remaining: Option<u64>,
    pub output_tokens_reset: Option<String>,
}

fn parse_u64_header(headers: &HeaderMap, name: &str) -> Option<u64> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
}

fn parse_str_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
}

pub async fn validate_anthropic_key(api_key: &str) -> Result<bool, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(ANTHROPIC_MODELS_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to validate Anthropic key: {e}"))?;

    Ok(response.status().is_success())
}

pub async fn fetch_claude_rate_limits(api_key: &str) -> Result<ClaudeRateLimitSnapshot, String> {
    let client = reqwest::Client::new();
    let models = ["claude-3-5-haiku-latest", "claude-sonnet-4-5"];
    let mut last_error: Option<String> = None;

    for model in models {
        let payload = serde_json::json!({
            "model": model,
            "max_tokens": 1,
            "messages": [
                { "role": "user", "content": "." }
            ]
        });

        let response = client
            .post(ANTHROPIC_MESSAGES_URL)
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Claude usage: {e}"))?;

        let status = response.status();
        let headers = response.headers().clone();
        let body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read Claude usage body: {e}"))?;

        if !status.is_success() {
            last_error = Some(format!("{model}: {status} - {body}"));
            continue;
        }

        let requests_limit = parse_u64_header(&headers, "anthropic-ratelimit-requests-limit");
        let requests_remaining = parse_u64_header(&headers, "anthropic-ratelimit-requests-remaining");
        let input_tokens_limit = parse_u64_header(&headers, "anthropic-ratelimit-input-tokens-limit");
        let input_tokens_remaining = parse_u64_header(&headers, "anthropic-ratelimit-input-tokens-remaining");
        let output_tokens_limit = parse_u64_header(&headers, "anthropic-ratelimit-output-tokens-limit");
        let output_tokens_remaining = parse_u64_header(&headers, "anthropic-ratelimit-output-tokens-remaining");

        let input_tokens_used = input_tokens_limit
            .zip(input_tokens_remaining)
            .map(|(limit, remaining)| limit.saturating_sub(remaining))
            .unwrap_or(0);
        let output_tokens_used = output_tokens_limit
            .zip(output_tokens_remaining)
            .map(|(limit, remaining)| limit.saturating_sub(remaining))
            .unwrap_or(0);

        return Ok(ClaudeRateLimitSnapshot {
            input_tokens_used,
            output_tokens_used,
            cache_creation_tokens_used: 0,
            cache_read_tokens_used: 0,
            requests_limit,
            requests_remaining,
            requests_reset: parse_str_header(&headers, "anthropic-ratelimit-requests-reset"),
            input_tokens_limit,
            input_tokens_remaining,
            input_tokens_reset: parse_str_header(&headers, "anthropic-ratelimit-input-tokens-reset"),
            output_tokens_limit,
            output_tokens_remaining,
            output_tokens_reset: parse_str_header(&headers, "anthropic-ratelimit-output-tokens-reset"),
        });
    }

    Err(format!(
        "Anthropic rate-limit probe failed for all fallback models: {}",
        last_error.unwrap_or_else(|| "unknown error".to_string())
    ))
}
