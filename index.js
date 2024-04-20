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

//https://clipdrop.co/apis/docs/text-to-image
async function getImageBuffer(prompt) {
  const formData = new FormData();
  formData.append("prompt", prompt);
  console.log(formData, API_KEY);

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

const getSimpleReply = async (context, comment) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const prompt = `suppose you are Cevin.AI. You are an AI model which can generate paint and give feedback based on your generation. I am giving you a prompt - ${context} .  now you have to imagine a painting detail based on the context. now based on your imaginary detail about that painting , generate a funny and energetic positive reply for this comment - ${comment}. make the reply  simple and short `;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return text;
};

async function test() {
  try {
    client.connect();

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

    app.get("/paintings", async (req, res) => {
      try {
        const result = await imageCollection
          .find()
          .sort({ _id: -1, likesCount: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/paintings/:id", verifyToken, async (req, res) => {
      try {
        console.log(req?.params?.id);
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

    app.post("/generate-image", verifyToken, async (req, res) => {
      try {
        // console.log(req);
        const body = req.body;
        const { prompt, email, activeType, activeCat } = body;
        if (!prompt || !email || !activeCat || !activeCat) {
          return res.status(500).send("error");
        }

        const promptFinal = `imagine : A ${activeCat}  ${activeType}  painting about ${prompt}`;
        const buffer = await getImageBuffer(promptFinal);
        const data = await postImageBB(buffer, prompt);

        console.log(data);
        if (data.success) {
          const newData = {
            ...data,
            userEmail: email,
            likes: [],
            likesCount: 0,
            price: parseInt(Math.random() * 1500 + 500),
            detail: prompt,
          };
          const result = await imageCollection.insertOne(newData);
          res.send(result);
        } else res.send(data);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.post("/comment", verifyToken, async (req, res) => {
      try {
        const body = req.body;
        const time = new Date();
        const reply = await getSimpleReply(body.context, body.comment);
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
