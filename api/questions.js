const questions = [
  { id: 'vp1', theme: 'Vision + Priorities', text: "Am I giving you enough information to do your job well?" },
  { id: 'vp2', theme: 'Vision + Priorities', text: "Would you like more or less direction from me right now?" },
  { id: 'vp3', theme: 'Vision + Priorities', text: "Do you feel clear on where we're headed and why?" },
  { id: 'vp4', theme: 'Vision + Priorities', text: 'Are there any priorities I can clarify for you?' },
  { id: 'ws1', theme: 'Work Style', text: "What part of my communication style makes your job harder than it should?" },
  { id: 'ws2', theme: 'Work Style', text: "Is there a decision I've made recently that you disagreed with—or didn't understand?" },
  { id: 'ws3', theme: 'Work Style', text: "What's something I could stop doing that would make things easier for you?" },
  { id: 'sl1', theme: 'Support + Load-Balancing', text: "Do you feel like you're spread too thin right now?" },
  { id: 'sl2', theme: 'Support + Load-Balancing', text: 'Is there anything I could take off your plate this week?' },
  { id: 'sl3', theme: 'Support + Load-Balancing', text: 'Have I been mindful enough of timelines and bandwidth?' },
  { id: 'sl4', theme: 'Support + Load-Balancing', text: 'Would it help to reprioritize anything?' },
  { id: 'cd1', theme: 'Coaching + Development', text: 'What aspect of your role would you like more coaching on?' },
  { id: 'cd2', theme: 'Coaching + Development', text: "Are there any skills you've been wanting to build but haven't had time?" },
  { id: 'cd3', theme: 'Coaching + Development', text: "Is there a challenge you're facing that we could unpack together?" },
  { id: 'cd4', theme: 'Coaching + Development', text: "What's a decision you're stuck on that we could talk through?" },
  { id: 'wc1', theme: 'Work Conditions', text: 'Am I interrupting you too often with meetings or requests?' },
  { id: 'wc2', theme: 'Work Conditions', text: 'Do you feel like you have enough focus time to get real work done?' },
  { id: 'wc3', theme: 'Work Conditions', text: "Is there any tool, resource, or system that's making your job harder than it needs to be?" },
  { id: 'td1', theme: 'Team + Dynamics', text: 'Are there any relationships or team dynamics that have felt tricky lately?' },
  { id: 'td2', theme: 'Team + Dynamics', text: "Is there a conversation we haven't had yet that we probably should?" },
  { id: 'td3', theme: 'Team + Dynamics', text: "What's something you wish people talked about more openly on the team?" },
  { id: 'ef1', theme: 'Efficiency + Frustrations', text: "What's one thing that's been frustrating you the past few weeks?" },
  { id: 'ef2', theme: 'Efficiency + Frustrations', text: 'What are your biggest time-wasters right now?' },
  { id: 'ef3', theme: 'Efficiency + Frustrations', text: "What's something you wish we did more efficiently as a team?" },
];

function toId(q) {
  return q && q.id ? q.id : null;
}

function toQuestion(id) {
  return questions.find(q => q.id === id) || null;
}

function findByText(text) {
  return questions.find(q => q.text === text) || null;
}

function idFromAny(input) {
  if (!input) return null;
  if (input.id) return input.id;
  if (input.text) {
    const q = findByText(input.text);
    return q ? q.id : null;
  }
  return null;
}

module.exports = { questions, toId, toQuestion, findByText, idFromAny };
