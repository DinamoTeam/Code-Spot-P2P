using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CodeSpot.Models
{
	public class FeedbackForm
	{
		public string SatisfactionLevel { get; set; }
		public string CollabLevel { get; set; }
		public string DidWell { get; set; }
		public string Issue { get; set; }
		public string IssueDetails { get; set; }
		public string Improvement { get; set; }
	}
}
