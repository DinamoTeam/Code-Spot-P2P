using Twilio.Rest.Api.V2010.Account;

namespace CodeSpotP2P.Data
{
    public interface ITurnServer
    {
        TokenResource getToken();
    }
}