using System.Net.WebSockets;
using System.Text.Json;

namespace Murchalka.ClientRuntime.Protocol;

/// <summary>Provides serialized authenticated access to the Murchalka realtime protocol.</summary>
public sealed class MurchalkaClient : IAsyncDisposable
{
    private readonly ClientConnectionOptions _options;
    private readonly ClientWebSocket _socket = new();
    private readonly SemaphoreSlim _exchangeGate = new(1, 1);
    private bool _authenticated;
    private bool _disposed;

    /// <summary>Creates a realtime client with validated connection options.</summary>
    /// <param name="options">The client connection options.</param>
    public MurchalkaClient(ClientConnectionOptions options)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _options.Validate();
    }

    /// <summary>Connects to the configured local realtime endpoint.</summary>
    /// <param name="cancellationToken">A token that cancels the connection.</param>
    public Task ConnectAsync(CancellationToken cancellationToken = default) =>
        _socket.ConnectAsync(_options.Endpoint, cancellationToken);

    /// <summary>Authenticates the current WebSocket session with local credentials.</summary>
    /// <param name="username">The local username.</param>
    /// <param name="password">The local password.</param>
    /// <param name="cancellationToken">A token that cancels authentication.</param>
    /// <returns>The authenticated principal response.</returns>
    public async ValueTask<JsonElement> AuthenticateAsync(string username, string password, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(username);
        ArgumentException.ThrowIfNullOrWhiteSpace(password);
        var response = await ExchangeAsync(JsonSerializer.SerializeToElement(new { type = "authenticate", username, password }), cancellationToken).ConfigureAwait(false);
        if (response.GetProperty("type").GetString() != "authenticated")
        {
            throw Failure(response);
        }

        _authenticated = true;
        return response;
    }

    /// <summary>Executes one interactive text turn.</summary>
    /// <param name="conversationId">The canonical conversation identifier.</param>
    /// <param name="text">The bounded user message.</param>
    /// <param name="idempotencyKey">A stable idempotency key for retry safety.</param>
    /// <param name="cancellationToken">A token that cancels the turn.</param>
    /// <returns>The completed agent turn response.</returns>
    public async ValueTask<JsonElement> SendTurnAsync(
        string conversationId,
        string text,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        EnsureAuthenticated();
        return await ExchangeAsync(
            JsonSerializer.SerializeToElement(new { type = "turn", conversationId, text, idempotencyKey }),
            cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Requests the declarative Agent UI document for a conversation.</summary>
    /// <param name="conversationId">The canonical conversation identifier.</param>
    /// <param name="cancellationToken">A token that cancels the request.</param>
    /// <returns>The Agent UI document response.</returns>
    public async ValueTask<JsonElement> GetAgentUiAsync(string conversationId, CancellationToken cancellationToken = default)
    {
        EnsureAuthenticated();
        return await ExchangeAsync(
            JsonSerializer.SerializeToElement(new { type = "ui.get", conversationId }),
            cancellationToken).ConfigureAwait(false);
    }

    private async ValueTask<JsonElement> ExchangeAsync(JsonElement request, CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        await _exchangeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await _socket.SendAsync(JsonSerializer.SerializeToUtf8Bytes(request), WebSocketMessageType.Text, true, cancellationToken).ConfigureAwait(false);
            var buffer = new byte[_options.MaximumMessageBytes];
            var result = await _socket.ReceiveAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (result.MessageType != WebSocketMessageType.Text || !result.EndOfMessage || result.Count == 0)
            {
                throw new InvalidDataException("Realtime response is not one bounded UTF-8 text frame.");
            }

            var response = JsonSerializer.Deserialize<JsonElement>(buffer.AsSpan(0, result.Count));
            if (response.TryGetProperty("type", out var type) && type.GetString() == "error")
            {
                throw Failure(response);
            }

            return response;
        }
        finally
        {
            _exchangeGate.Release();
        }
    }

    private void EnsureAuthenticated()
    {
        if (!_authenticated)
        {
            throw new InvalidOperationException("AuthenticateAsync must succeed before product actions.");
        }
    }

    private static InvalidOperationException Failure(JsonElement response)
    {
        var code = response.TryGetProperty("code", out var codeValue) ? codeValue.GetString() : "realtime-failed";
        var message = response.TryGetProperty("message", out var messageValue) ? messageValue.GetString() : "Realtime request failed.";
        return new InvalidOperationException($"{code}: {message}");
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        if (_socket.State == WebSocketState.Open)
        {
            await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "client-disposed", CancellationToken.None).ConfigureAwait(false);
        }

        _socket.Dispose();
        _exchangeGate.Dispose();
    }
}
