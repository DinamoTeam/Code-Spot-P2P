using Twilio;
using Twilio.Rest.Api.V2010.Account;

namespace CodeSpotP2P.Data
{
    public class TurnServer : ITurnServer
    {
        readonly string accountSid = "GET FROM ENV";
        readonly string authToken = "GET FROM ENVs";
        public TurnServer()
        {
            TwilioClient.Init(accountSid, authToken);
        }
        public TokenResource getToken()
        {
            return TokenResource.Create();
        }
    }
}