const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API);
async function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType,
    },
  };
}

async function getImageDetail(buffer) {
  try {
    const image = await fileToGenerativePart(buffer, "image/jpeg");

    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    const prompt = "tell me in a detail about this picture?";
    const result = await model.generateContent([prompt, image]);
    const googleResponse = result.response;
    const response = googleResponse.text();
    // console.log(response);
    return { response };
  } catch (err) {
    console.log(err);
  }
}

module.exports = getImageDetail;
