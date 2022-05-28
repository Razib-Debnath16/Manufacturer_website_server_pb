const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)


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
        const ordersCollection = client.db("toolsCollection").collection("orders");
        const paymentCollection = client.db("toolsCollection").collection("payment");
        const reviewsCollection = client.db("toolsCollection").collection("reviews");
        const profilesCollection = client.db("toolsCollection").collection("profile");

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

        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ["card"]
                });
                res.json({
                    clientSecret: paymentIntent.client_secret,
                });
            }
            catch (e) {
                res.status(400).json({ error: { message: e.message } });
            }
        });

        app.post('/orders', async (req, res) => {
            const data = req.body;
            const doc = {
                name: data.name,
                email: data.email,
                quantity: data.quantity,
                address: data.address,
                phone: data.phone,
                price: data.price
            }
            const result = await ordersCollection.insertOne(doc);
            res.send(result);
        });
        app.post('/reviews', async (req, res) => {
            const data = req.body;
            const doc = {
                name: data.name,
                email: data.email,
                img: data.img,
                review: data.review
            }
            const result = await reviewsCollection.insertOne(doc);
            res.send(result);
        });
        app.post('/tools', async (req, res) => {
            const data = req.body;
            const doc = {
                name: data.name,
                img: data.img,
                des: data.des,
                quantity: data.quantity,
                stock: data.stock,
                price: data.price,
                email: data.email
            }
            const result = await toolsCollection.insertOne(doc);
            res.send(result);
        });
        app.post('/profile', async (req, res) => {
            const data = req.body;
            const doc = {
                name: data.name,
                email: data.email,
                edu: data.education,
                loc: data.location,
                linkedin: data.linkedin
            }
            const result = await profilesCollection.insertOne(doc);
            res.send(result);
        });
        app.get('/reviews', async (req, res) => {
            const query = {};
            const result = await reviewsCollection.find(query).toArray();
            res.send(result);
        });
        app.patch('/orders/:id', async (req, res) => {

            const id = req.params.id;
            const partsId = req.body.partsId;
            const transactionId = req.body.transactionId;
            const payment = {
                partsId,
                transactionId
            }
            const query = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    status: 'pending',
                    transactionId: transactionId
                }
            }
            const updatedOrders = await ordersCollection.updateOne(query, updatedDoc);
            const paymentUpdate = await paymentCollection.insertOne(payment);
            res.send(updatedDoc);
        })
        app.put('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'Shipped',
                }
            }
            const updatedOrder = await ordersCollection.updateOne(query, updatedDoc);
            res.send(updatedOrder);
        })
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const updatedOrder = await ordersCollection.deleteOne(query);
            res.send(updatedOrder);
        })

        app.patch('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'Canceled',
                }
            }
            const updatedOrders = await ordersCollection.updateOne(query, updatedDoc);
            res.send(updatedOrders);

        })

        app.get('/user', async (req, res) => {

            const users = await usersCollection.find().toArray();
            res.send(users);
        });
        app.get('/orders', async (req, res) => {
            const query = {};
            const users = await ordersCollection.find(query).toArray();
            res.send(users);
        });
        app.get('/orders/email', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const users = await ordersCollection.find(query).toArray();
            res.send(users);
        });
        app.get('/user/email', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.find(query).toArray();
            res.send({ user });
        });
        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const users = await ordersCollection.find(query).toArray();
            res.send(users);
        });
        app.delete('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        });
        app.get('/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const decodedUser = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        });

        app.put('/user/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: {
                    role: 'admin',
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
                    user
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
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        })
        app.put('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const newStock = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                stock: newStock
            }
            const tool = await toolsCollection.updateOne(filter, updateDoc, options);
            res.send(newStock);
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