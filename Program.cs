using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
namespace CodeSpotP2P
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateWebHostBuilder(args).Build().Run();
        }

        public static IWebHostBuilder CreateWebHostBuilder(string[] args) =>
            WebHost.CreateDefaultBuilder(args)
                .UseApplicationInsights("7751c57d-65c0-4c61-97c5-1fd7b61b80dc")
                .UseStartup<Startup>();
    }
}