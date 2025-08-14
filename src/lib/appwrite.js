import { Client, Databases, Account } from "appwrite";

const client = new Client()
  .setEndpoint("https://appwrite.jauzin23.com/v1")
  .setProject("689c99120038471811fa");

const databases = new Databases(client);
const account = new Account(client);
const DBRESTAURANTE = "689c9a200025de0e8af2";
const COL_MENU = "689d00e2001afa755161";
const COL_ORDERS = "689deb6800375112de90";
const COL_TABLES = "689c9a26000b5abf71c8";

export {
  client,
  databases,
  account,
  DBRESTAURANTE,
  COL_MENU,
  COL_ORDERS,
  COL_TABLES,
};
