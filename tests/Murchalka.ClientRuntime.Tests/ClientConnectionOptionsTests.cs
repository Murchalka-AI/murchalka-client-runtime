using Murchalka.ClientRuntime.Protocol;
using Xunit;

namespace Murchalka.ClientRuntime.Tests;

/// <summary>Verifies security-sensitive client endpoint validation.</summary>
public sealed class ClientConnectionOptionsTests
{
    /// <summary>Verifies that the canonical loopback realtime endpoint is accepted.</summary>
    [Fact]
    public void LoopbackRealtimeEndpointIsAccepted()
    {
        var options = new ClientConnectionOptions { Endpoint = new Uri("ws://127.0.0.1:5080/v1/realtime") };

        options.Validate();
    }

    /// <summary>Verifies that a remote plaintext WebSocket is rejected.</summary>
    [Fact]
    public void RemoteEndpointIsRejected()
    {
        var options = new ClientConnectionOptions { Endpoint = new Uri("ws://example.com/v1/realtime") };

        Assert.Throws<ArgumentException>(options.Validate);
    }

    /// <summary>Verifies that unbounded response sizes are rejected.</summary>
    [Fact]
    public void OversizedMessageLimitIsRejected()
    {
        var options = new ClientConnectionOptions
        {
            Endpoint = new Uri("ws://127.0.0.1:5080/v1/realtime"),
            MaximumMessageBytes = 2 * 1024 * 1024
        };

        Assert.Throws<ArgumentOutOfRangeException>(options.Validate);
    }
}

