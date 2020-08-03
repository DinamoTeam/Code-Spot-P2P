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

			SendEmail(emailBody);

			return Ok(new {response = "Email sent sucessful!"});
		}

		// POST: api/Utilities/SendFeedbackForm
		[HttpPost]
		public OkObjectResult SendFeedbackForm([FromBody] FeedbackForm form)
		{
			string emailBody = string.Empty;
			emailBody += "<p>Your overall satisfaction of the app: " + form.SatisfactionLevel + "</p>";
			emailBody += "<p>How satisfied are you with the ability to collaborate with others using this app? " + form.CollabLevel + "</p>";
			emailBody += "<p>What do you like most about the app? " + form.DidWell + "</p>";
			emailBody += "<p>Which of the issues below was the biggest problem during your experience? " + form.Issue + "</p>";
			emailBody += "<p>Please describe the problem you encountered in more detail: " + form.IssueDetails + "</p>";
			emailBody += "<p>Do you have any suggestions for improvement? " + form.Improvement + "</p>";

			SendEmail(emailBody);

			return Ok(new { response = "Email sent sucessful!" });
		}

		private void SendEmail(string emailBody)
		{
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

					// TODO: Catch if send email fail
				}
			}
		}
	}
}
