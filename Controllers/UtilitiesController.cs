using CodeSpot.Models;
using Microsoft.AspNetCore.Mvc;
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
		static readonly string emailFromAddress = "sender@gmail.com";
		static readonly string password = "Abc@123$%^";

		// POST: api/Utilities/SendEmail
		[HttpPost]
		public void SendEmail([FromBody] ContactForm form)
		{
			string emailBody = string.Empty;
			emailBody += "Name: " + form.Name + "\n";
			emailBody += "Email: " + form.Email + "\n";
			emailBody += "Subject: " + form.Subject + "\n";
			emailBody += "Message:" + "\n";
			emailBody += "\t" + form.Message + "\n";

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
					smtp.Credentials = new NetworkCredential(emailFromAddress, password);
					smtp.EnableSsl = enableSSL;
					smtp.Send(email);
				}
			}
		}
	}
}
