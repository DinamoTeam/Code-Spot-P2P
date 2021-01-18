using System;
using Twilio;
using Twilio.Rest.Api.V2010.Account;

namespace CodeSpotP2P.Data
{
    public class TurnServer : ITurnServer
    {
        readonly string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        readonly string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");
        public TurnServer()
        {
            try
            {
                TwilioClient.Init(accountSid, authToken);
            }
            catch (Exception)
            {
                // Invalid accountSid or authToken
            }
        }
        public TokenResource getToken()
        {
            try
            {
                return TokenResource.Create();
            }
            catch (Exception e)
            {
                throw e;
            }
        }
    }
}