import { Client, Databases, Account } from "appwrite";

const client = new Client()
  .setEndpoint("https://appwrite.jauzin23.com/v1")
  .setProject("689c99120038471811fa");

const databases = new Databases(client);
const account = new Account(client);

export { client, databases, account };
