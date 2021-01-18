using CodeSpotP2P.Data;
using Microsoft.AspNetCore.Mvc;
using Twilio.Rest.Api.V2010.Account;

namespace WebCRM.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TurnServerTokenController : ControllerBase
    {
        readonly ITurnServer _turnServer;
        public TurnServerTokenController(ITurnServer turnServer)
        {
            _turnServer = turnServer;
        }

        // GET api/turnServerToken
        [HttpGet]
        public ActionResult<TokenResource> Get()
        {
            return _turnServer.getToken();
        }
    }
}
