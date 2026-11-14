# Fox Four

A separate single-file AI orchestration application by Monty Kubasek.

[Launch Fox Four](index.html) · [Application source](four-fox-improved.html)

The application's documented flow is:

```text
GLM + DeepSeek + Kimi + Qwen (parallel)
                  ↓
MiniMax M3: analysis → synthesis → critic
```

Provider responses require an OpenRouter key and an internet connection. The client keeps local retrieval and explicit context sharing in the browser. The application source was moved without changing its bytes.

Serve from the repository root (`python3 -m http.server 8000`), then open `/fox-four/`.
