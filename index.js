/*************************************************
 *     Package Initialization
 *************************************************/
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
//npm i @google/generative-ai;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MongoClient, ServerApiVersion, ObjectId, Binary } = require("mongodb");

/*************************************************
 *     Middleware integration
 *************************************************/
require("dotenv").config();
app.use(
  cors({
    origin: ["http://localhost:5173", "https://canvascraft-ai.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log('token in the middleware', token);
  // no token available
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "invalid token access" });
    }
    req.user = decoded;
    next();
  });
};
/*************************************************
 *     Secret Keys Integration
 *************************************************/

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API);
const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const port = process.env.PORT || 5000;
const API_KEY = process.env.APIKEY;
const image_hosting_key = process.env.IMAGE_HOSTING_KEY;
const image_hosting_api = `https://api.imgbb.com/1/upload?key=${image_hosting_key}`;

/*************************************************
 *     Database integration
 *************************************************/
const client = new MongoClient(process.env.URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/***********************
 utilites functions 
 ***********************************
*/
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
    const prompt = "tell me in a detail about this picture?";
    const result = await visionModel.generateContent([prompt, image]);
    const googleResponse = await result.response;
    const response = googleResponse.text();
    // console.log(response);
    return { response };
  } catch (err) {
    console.log(err);
    ``;
  }
}

//https://clipdrop.co/apis/docs/text-to-image
async function getImageBuffer(prompt) {
  const formData = new FormData();
  formData.append("prompt", prompt);
  console.log(formData);

  const response = await fetch("https://clipdrop-api.co/text-to-image/v1", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch image buffer");
  }

  return await response.arrayBuffer();
}

//https://api.imgbb.com/
// extended:: convert buffer to file using BLOB then send through API
async function postImageBB(buffer, prompt) {
  try {
    // console.log(buffer);
    const imageFormData = new FormData();
    imageFormData.append(
      "image",
      new Blob([buffer], { type: "image/jpeg" }),
      `${prompt}.jpg`
    );

    const response = await fetch(image_hosting_api, {
      method: "POST",
      // headers: {
      //   "content-type": "multipart/form-data",
      // },
      body: imageFormData,
    });

    const imgData = await response.json();

    return imgData;
  } catch (err) {
    console.log(err);
  }
}

//https://ai.google.dev/gemini-api/docs/get-started/node

// Thats The simple version.  It can generate irreleveant data . model with history could narrow down the reply . watch contextualTextGeneraton.js file

const getAiReply = async (context, comment) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [
          {
            text: "giving  you a detail about a painting. people will give you feedbacks for this painting / ask you something about the painting.you have to make a reply based on the detail  by acting that , you are cevin.AI . you draw that painting. and you will make feedback replies. user can say anything based on the comment . it could be  positive or negative . You must have to reply. try to make it funny and engaged. if you dont understand the feedback reply. reply that you did not get your comment. could please comment again ? ",
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
  try {
    const result = await chat.sendMessage(comment);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (err) {}
};
const getAiDetail = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [
          {
            text: "giving  you  a title about a painting. imagine a painting from this title then think about a possible simple detail.",
          },
        ],
      },
      {
        role: "model",
        parts: [{ text: "Great. What is the painting title" }],
      },
      {
        role: "user",
        parts: [
          {
            text: "A programmer coding in a dark room",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "A programmer coding in a dark room where a man sitting at a desk and working on his computer. He is wearing headphones and there is a tablet on the desk to his left. The background is dark and there is a colorful pattern on the screen of his computer. The painting is done in a realistic style and the colors are vibrant and saturated. The man is wearing a blue shirt and he has a beard. He is focused on his work and he does not seem to be aware of the viewer. The painting is set in a modern-day office and it depicts a common scene. The overall mood of the painting is one of peace and tranquility.",
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: "female teacher teaching her students under the tree",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "female teacher teaching her students under the tree where a group of people gathered under a tree. The central figure is a woman, dressed in a long white robe, who is reading from a book. The others are sitting in a circle around her, listening attentively. The setting is a lush green field, with trees in the background. The sun is shining brightly, and there is a sense of peace and tranquility. The painting is done in a realistic style, and the figures are depicted with great detail. The colors are vibrant and lifelike, and the overall effect is one of beauty and harmony.",
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 200,
    },
  });
  const result = await chat.sendMessage(prompt);
  const response = await result.response;
  const text = response.text();
  return text;
};

async function test() {
  try {
    client.connect();

    app.get("/detail", async (req, res) => {
      const prompt = req.query.prompt;
      if (!prompt) {
        return res.send("No Valid Prompt Found");
      }
      const detail = await getAiDetail(prompt);
      res.send(detail);
    });

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.SECRET, {
        expiresIn: "1h",
      });

      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    /*************************************************
     *     Collection initialization
     *************************************************/

    const database = client.db("canvas-craft-db");
    const imageCollection = database.collection("images");
    const cartCollection = database.collection("carts");
    const commentCollection = database.collection("comments");

    /*************************************************
     *     Get API Endpoint Definition x 4
     *************************************************/
    app.get("/run-script", async (req, res) => {
      const data = await imageCollection.find({ detail: null }).toArray();

      res.send({ file: data[0] });
    });

    app.get("/paintings", async (req, res) => {
      try {
        const result = await imageCollection.find().sort({ _id: -1 }).toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/recent-paintings", async (req, res) => {
      try {
        const result = await imageCollection
          .find()
          .sort({ _id: -1 })
          .limit(6)
          .toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/liked-paintings", async (req, res) => {
      try {
        const result = await imageCollection
          .find()
          .sort({ likesCount: -1 })
          .limit(6)
          .toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/paintings/:id", async (req, res) => {
      try {
        console.log("id found for painting details = " + req?.params?.id);
        const result = await imageCollection.findOne({
          _id: new ObjectId(req?.params?.id),
        });
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/comments/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { imageId: id };
      console.log(query);
      const data = await commentCollection
        .find(query)
        .sort({ time: -1 })
        .toArray();
      res.send(data);
    });
    app.get("/my-comments", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) return res.send([]);
      const query = { email: email };
      console.log(query);
      const data = await commentCollection
        .find(query)
        .sort({ time: -1 })
        .toArray();
      res.send(data);
    });

    /*************************************************
     *     POST API Endpoint Definition x 2
     *************************************************/

    app.post("/generate-image", async (req, res) => {
      let newID;
      try {
        const body = req.body;

        const { prompt, email, activeType, activeCat } = body;
        if (!prompt || !email || !activeCat || !activeType) {
          return res.status(500).send("error");
        }

        const result = await imageCollection.insertOne({ status: true });
        newID = result.insertedId;
        res.send(result);

        // const detail = await getAiDetail(prompt);

        // let promptDetail = detail.replaceAll(".", "");
        // promptDetail = detail.replaceAll(",", "");
        const promptFinal = `imagine : A ${activeCat}  ${activeType}  painting about ${prompt}`;
        const buffer = await getImageBuffer(promptFinal);
        console.log("buffer achieved");
        const detail = await getImageDetail(buffer);
        console.log("detail acchieved. detail = " + detail);
        const data = await postImageBB(buffer, prompt);

        if (data.success) {
          const newData = {
            ...data,
            userEmail: email,
            likes: [],
            likesCount: 0,
            price: parseInt(Math.random() * 1500 + 500),
            detail: detail?.response,
            status: false,
          };
          console.log("new Data Created . Data = ", newData);
          const updateStatus = await imageCollection.updateOne(
            {
              _id: new ObjectId(result.insertedId),
            },
            {
              $set: { ...newData },
            }
          );
          console.log("update status = ", updateStatus);
        }
      } catch (error) {
        await imageCollection.deleteOne({ _id: new ObjectId(newID) });
        res.send({ status: false });
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/comment", verifyToken, async (req, res) => {
      try {
        const body = req.body;
        const time = new Date();
        const reply =
          (await getAiReply(body.context, body.comment)) ||
          "Cavin is may be busy right now. he will reply later";

        const data = {
          ...body,
          time,
          likes: [],
          likesCount: 0,
          reply,
        };
        const result = await commentCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    /*************************************************
     *     DELETE API Endpoint Definition x 1
     *************************************************/

    app.delete("/comments/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await commentCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    /*************************************************
     *     PUT API Endpoint Definition x 1
     *************************************************/
    app.put("/my-comments/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const newComment = req.body.newComment;
        const context = req.body.context;
        const newReply = await getAiReply(context, newComment);
        if (!newReply) return res.send({ status: false });

        const query = { _id: new ObjectId(id) };

        const updatedData = {
          $set: {
            comment: newComment,
            reply: newReply,
          },
        };

        const result = await commentCollection.updateOne(query, updatedData, {
          upsert: true,
        });
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    /*************************************************
     *     Patch API Endpoint Definition x 2
     *************************************************/

    app.patch("/react", verifyToken, async (req, res) => {
      const body = req.body;
      const { email, likes, imageId } = body;
      const query = { _id: new ObjectId(imageId) };
      let updatedData = {};
      const isLiked = likes.find(
        (likedEmail) => likedEmail.toLowerCase() == email.toLowerCase()
      );
      if (isLiked) {
        updatedData = {
          $set: {
            likes: likes.filter((like) => like != email),
            likesCount: likes.filter((like) => like != email).length,
          },
        };
      } else {
        updatedData = {
          $set: {
            likes: [...likes, email],
            likesCount: [...likes, email].length,
          },
        };
      }

      const result = await imageCollection.updateOne(query, updatedData);
      res.send(result);
    });

    client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
test().catch(console.dir);
app.get("/", async (req, res) => {
  res.send({ status: "Server running ", code: "200" });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
