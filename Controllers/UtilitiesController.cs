using CodeSpot.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;

namespace CodeSpot.Controllers
{
	[Route("api/[controller]/[action]")]
	[ApiController]
	public class UtilitiesController : ControllerBase
	{
		static readonly string smtpAddress = "smtp.gmail.com";
		static readonly int portNumber = 587;
		static readonly bool enableSSL = true;
		static readonly string emailFromAddress = "DinamoTeam20@gmail.com";
		private readonly IConfiguration Configuration;

		public UtilitiesController(IConfiguration configuration)
		{
			Configuration = configuration;
		}

		// POST: api/Utilities/SendEmail
		[HttpPost]
		public OkObjectResult SendEmail([FromBody] ContactForm form)
		{
			string emailBody = string.Empty;
			emailBody += "<p>Name: " + form.Name + "</p>";
			emailBody += "<p>Email: " + form.Email + "</p>";
			emailBody += "<p>Subject: " + form.Subject + "</p>";
			emailBody += "<p>Message:" + "</p>";
			emailBody += "<p>" + form.Message + "</p>";

			string password = Configuration["EmailPassword"];

			using (MailMessage email = new MailMessage())
			{
				email.From = new MailAddress(emailFromAddress);
				email.To.Add("gtt27@drexel.edu");
				email.To.Add("atran33@mylangara.ca");
				email.Subject = "Message from Code Spot";
				email.Body = emailBody;
				email.IsBodyHtml = true;

				using (SmtpClient smtp = new SmtpClient(smtpAddress, portNumber))
				{
					smtp.UseDefaultCredentials = false;
					smtp.Credentials = new NetworkCredential(emailFromAddress, password);
					smtp.EnableSsl = enableSSL;
					smtp.Send(email);
				}
			}

			return Ok("Email sent sucessful!");
		}
	}
}
