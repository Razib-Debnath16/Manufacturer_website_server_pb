const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.urkp7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("toolsCollection").collection("tools");
        const usersCollection = client.db("toolsCollection").collection("user");

        function verifyJwt(req, res, next) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'UnAuthorized Access' });
            }
            const token = authHeader.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
                if (err) {
                    return res.status(403).send({ message: 'Forbidden Access' })
                }
                req.decoded = decoded;
                next();
            });

        }

        app.get('/user', async (req, res) => {

            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        app.put('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: {
                    plot: { role: 'admin' },
                },
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    plot: user,
                },
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.send({ result, token });
        })
        app.get('/tools', async (req, res) => {
            const query = {};
            const tools = await toolsCollection.find(query).toArray();
            res.send(tools);
        })
        app.get('/tools/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        })
        app.get('/', (req, res) => {
            res.send('hello');
        })


    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`port: ${port}`)
})