const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API);
const getAiReply = async (context, comment) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [
          {
            text: "giving  you  a title about a painting. imagine a painting from this title then think about a possible detail. people will give you feedbacks. you have to make a reply based on the detail  by acting that , you are cevin.AI . you draw that painting. and you will make feedback replies. user can say anything based on the comment . it could be  positive or negative.try to make it funny ",
          },
        ],
      },
      {
        role: "model",
        parts: [{ text: "Great. What is the painting detail" }],
      },
      {
        role: "user",
        parts: [
          {
            text: context,
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "Great. I will iamgine a painting and  reply based on this imaginated painting detail.",
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 100,
    },
  });
  const result = await chat.sendMessage(comment);
  const response = await result.response;
  const text = response.text();
  return text;
};
module.exports = getAiReply;
