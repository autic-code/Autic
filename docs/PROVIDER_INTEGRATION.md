# Provider Integration Guide

> Version: 0.1.0 | How to configure and manage LLM providers in Autic.

## Overview

Autic supports multiple LLM providers through a unified provider abstraction layer. All providers implement the same interface, enabling seamless switching and fallback.

## Quick Start

```bash
# Add a provider
autic providers add openrouter --key sk-or-v1-xxxxxxxx

# Verify connectivity
autic providers check

# List configured providers
autic providers

# Test with a model
autic chat --model gpt-4o
```

## Supported Providers

### 1. OpenRouter (Recommended)

**Best for:** Access to 200+ models through a single API key.

```bash
autic providers add openrouter --key YOUR_API_KEY
```

**Environment variables:**
- `AUTIC_OPENROUTER_KEY` or `OPENROUTER_API_KEY`

**Available models:** GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Claude 3 Opus, Gemini Pro, Gemini Ultra, Llama 3, Mixtral, DeepSeek, and 200+ more.

**Rate limits:** Varies by model. OpenRouter applies credits-based rate limiting.

**Configuration options:**
```bash
autic config set openrouter.base_url https://openrouter.ai/api/v1
autic config set openrouter.timeout 60000
```

### 2. Ollama (Local)

**Best for:** Local development, offline workflows, privacy-sensitive tasks.

```bash
autic providers add ollama --url http://localhost:11434
```

**Environment variables:**
- `AUTIC_OLLAMA_URL`

**Requirements:**
- [Ollama](https://ollama.com) installed and running
- Models pulled: `ollama pull llama3`, `ollama pull mistral`, etc.

**Available models:** All Ollama-compatible models (Llama 3, Mistral, CodeLlama, DeepSeek, etc.)

**Configuration:**
```bash
autic config set ollama.timeout 120000
autic config set ollama.keep_alive 5m
```

### 3. OpenAI (Direct)

**Best for:** Direct OpenAI API access without routing through OpenRouter.

```bash
autic providers add openai --key YOUR_API_KEY
```

**Environment variables:**
- `AUTIC_OPENAI_KEY` or `OPENAI_API_KEY`

**Available models:** GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 Turbo, o1-preview, o1-mini.

**Rate limits:** Based on your OpenAI plan (Tier 1-5).

### 4. Anthropic (Direct)

**Best for:** Direct Claude API access.

```bash
autic providers add anthropic --key YOUR_API_KEY
```

**Environment variables:**
- `AUTIC_ANTHROPIC_KEY` or `ANTHROPIC_API_KEY`

**Available models:** Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku.

**Rate limits:** Based on your Anthropic API tier.

## Provider Configuration

### Multi-Provider Setup

Configure multiple providers for resilience and intelligent routing:

```bash
# Add multiple providers
autic providers add openrouter --key sk-or-...
autic providers add ollama --url http://localhost:11434
autic providers add openai --key sk-...

# View all providers
autic providers

# Check all provider health
autic providers check
```

### Provider Priority

Autic routes requests based on:
1. Explicit model/provider selection (`--model`, `--provider`)
2. Provider health and availability
3. Model capability matching task requirements
4. Fallback chain if primary provider fails

### Provider Fallback

When a provider fails, Autic automatically falls back to the next available provider:

```bash
# Configure fallback behavior
autic config set provider.fallback_enabled true
autic config set provider.fallback_order openrouter,ollama,openai
```

## Provider Health Monitoring

```bash
# Quick health check
autic providers check

# Detailed provider metrics
autic observability provider

# Provider latency profiling
autic profiling provider

# Chaos test provider resilience
autic chaos
```

## Provider Security

### API Key Management

```bash
# Securely store API keys in encrypted vault
autic providers add openrouter --key sk-or-...

# Verify vault status
autic security vault

# Run security validation
autic validate-security
```

### Key Rotation

```bash
# Update a provider's API key
autic providers add openrouter --key NEW_KEY

# Remove a provider
autic providers remove openrouter
```

## Troubleshooting

### No Provider Available

```bash
# Check configured providers
autic providers

# Run diagnostics
autic doctor

# Check security status
autic security status
```

### Authentication Failures

```bash
# Verify API key is set
autic security vault

# Re-add provider with correct key
autic providers add openrouter --key CORRECT_KEY
```

### Rate Limiting

```bash
# Check rate limit configuration
autic config

# Reduce request rate
autic config set provider.rate_limit.requests_per_minute 10

# Use multiple providers for load balancing
autic providers add openai --key sk-...
```

### Slow Responses

```bash
# Profile provider latency
autic profiling provider

# Check network connectivity
autic doctor

# Increase timeout
autic config set openrouter.timeout 120000
```
