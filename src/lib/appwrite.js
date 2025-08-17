import { Client, Databases, Account } from "appwrite";

const client = new Client()
  .setEndpoint("https://appwrite.jauzin23.com/v1")
  .setProject("689c99120038471811fa");

const databases = new Databases(client);
const account = new Account(client);
const DBRESTAURANTE = "689c9a200025de0e8af2";
const DB_ATTENDANCE = "689d00b8001c10d4d6a2";
const COL_MENU = "689d00e2001afa755161";
const COL_ORDERS = "689deb6800375112de90";
const COL_TABLES = "689c9a26000b5abf71c8";
const COL_ATTENDANCE = "689f484b000af0ce9173";
const COL_STOCK = "68a1f4b1002d0630a22d";
const COL_TAGS = "68a2122700108d29391d";
const COL_CATEGORY = "68a211d80028d7e913b5";
const COL_CATEGORY_STOCK = "68a225d9001a31733dc6";
const COL_SUPPLIER = "68a2264a0004bc86faf4";
const LOCATION_STOCK = "68a226bf000acf2e23e6";

export {
  client,
  databases,
  account,
  DBRESTAURANTE,
  DB_ATTENDANCE,
  COL_MENU,
  COL_ORDERS,
  COL_TABLES,
  COL_ATTENDANCE,
  COL_STOCK,
  COL_TAGS,
  COL_CATEGORY,
  COL_CATEGORY_STOCK,
  COL_SUPPLIER,
  LOCATION_STOCK,
};
