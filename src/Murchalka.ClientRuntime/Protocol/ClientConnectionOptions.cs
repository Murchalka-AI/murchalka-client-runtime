using System.Net;

namespace Murchalka.ClientRuntime.Protocol;

/// <summary>Configures a bounded connection to the local realtime protocol module.</summary>
public sealed class ClientConnectionOptions
{
    /// <summary>Gets or sets the explicit loopback WebSocket endpoint.</summary>
    public required Uri Endpoint { get; init; }

    /// <summary>Gets or sets the maximum accepted UTF-8 response size.</summary>
    public int MaximumMessageBytes { get; init; } = 65536;

    /// <summary>Validates the security-sensitive connection options.</summary>
    public void Validate()
    {
        if (Endpoint.Scheme != "ws" ||
            !IPAddress.TryParse(Endpoint.Host, out var address) ||
            !IPAddress.IsLoopback(address) ||
            Endpoint.AbsolutePath != "/v1/realtime")
        {
            throw new ArgumentException("Endpoint must be an explicit ws:// loopback /v1/realtime URI.", nameof(Endpoint));
        }

        if (MaximumMessageBytes is < 4096 or > 1048576)
        {
            throw new ArgumentOutOfRangeException(nameof(MaximumMessageBytes), "MaximumMessageBytes must be between 4 KiB and 1 MiB.");
        }
    }
}

