using System.IO;
using Microsoft.AspNetCore.Mvc;

namespace Code_Spot_P2P.Controllers
{
    public class FallbackController : Controller
    {
        public IActionResult Index()
        {
            return PhysicalFile(Path.Combine(Directory.GetCurrentDirectory(),
                    "wwwroot", "index.html"), "text/HTML");
        }
    }
}