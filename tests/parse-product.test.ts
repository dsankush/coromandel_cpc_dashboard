import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseProduct1Name, CPC_PRODUCT_CATALOG, readOrdersCSV } from "../lib/parse";

describe("Official CPC Product & SKU Catalog Parser", () => {
  test("parses standard two-item order: Fantac Plus 1 ltr 1, Prachand 40 ml 4", () => {
    const input = "Fantac Plus 1 ltr 1, Prachand 40 ml 4";
    const result = parseProduct1Name(input);

    assert.equal(result.length, 2);

    assert.deepEqual(result[0], {
      productName: "Fantac Plus",
      skuSize: "1 ltr",
      packSize: "1 ltr",
      quantity: 1,
      rawString: "Fantac Plus 1 ltr 1",
    });

    assert.deepEqual(result[1], {
      productName: "Prachand",
      skuSize: "40 ml",
      packSize: "40 ml",
      quantity: 4,
      rawString: "Prachand 40 ml 4",
    });
  });

  test("parses 5-item multi-product order from real dataset", () => {
    const input =
      "Blitz 80 gm 4, Marvex 150 ml 1, Benofit 200 gm 2, Prachand 40 ml 1, Fantac Plus 25 ml 2";
    const result = parseProduct1Name(input);

    assert.equal(result.length, 5);

    assert.equal(result[0].productName, "Blitz");
    assert.equal(result[0].skuSize, "80 gm");
    assert.equal(result[0].quantity, 4);

    assert.equal(result[1].productName, "Marvex");
    assert.equal(result[1].skuSize, "150 ml");
    assert.equal(result[1].quantity, 1);

    assert.equal(result[2].productName, "Benofit");
    assert.equal(result[2].skuSize, "200 gm");
    assert.equal(result[2].quantity, 2);

    assert.equal(result[3].productName, "Prachand");
    assert.equal(result[3].skuSize, "40 ml");
    assert.equal(result[3].quantity, 1);

    assert.equal(result[4].productName, "Fantac Plus");
    assert.equal(result[4].skuSize, "25 ml");
    assert.equal(result[4].quantity, 2);
  });

  test("correctly expands collapsed multi-SKU orders (e.g. Row 72)", () => {
    const input = "Prachand 160 ml 10, Prospell 250 ml,1 ltr 2,7";
    const result = parseProduct1Name(input);

    assert.equal(result.length, 3);
    assert.deepEqual(result[0], {
      productName: "Prachand",
      skuSize: "160 ml",
      packSize: "160 ml",
      quantity: 10,
      rawString: "Prachand 160 ml 10",
    });
    assert.deepEqual(result[1], {
      productName: "Prospell",
      skuSize: "250 ml",
      packSize: "250 ml",
      quantity: 2,
      rawString: "Prospell 250 ml 2",
    });
    assert.deepEqual(result[2], {
      productName: "Prospell",
      skuSize: "1 ltr",
      packSize: "1 ltr",
      quantity: 7,
      rawString: "Prospell 1 ltr 7",
    });
  });

  test("correctly expands triple-SKU collapsed orders (e.g. Row 181)", () => {
    const input =
      "Fantac Plus 500 ml,250 ml,1 ltr 1,1,1, Prachand 400 ml,160 ml 3,2, Benofit 800 gm 1";
    const result = parseProduct1Name(input);

    assert.equal(result.length, 6);
    assert.equal(result[0].productName, "Fantac Plus");
    assert.equal(result[0].skuSize, "500 ml");
    assert.equal(result[0].quantity, 1);

    assert.equal(result[1].productName, "Fantac Plus");
    assert.equal(result[1].skuSize, "250 ml");
    assert.equal(result[1].quantity, 1);

    assert.equal(result[2].productName, "Fantac Plus");
    assert.equal(result[2].skuSize, "1 ltr");
    assert.equal(result[2].quantity, 1);

    assert.equal(result[3].productName, "Prachand");
    assert.equal(result[3].skuSize, "400 ml");
    assert.equal(result[3].quantity, 3);

    assert.equal(result[4].productName, "Prachand");
    assert.equal(result[4].skuSize, "160 ml");
    assert.equal(result[4].quantity, 2);

    assert.equal(result[5].productName, "Benofit");
    assert.equal(result[5].skuSize, "800 gm");
    assert.equal(result[5].quantity, 1);
  });

  test("correctly expands heavy multi-product multi-SKU order (e.g. Row 1904)", () => {
    const input =
      "Blitz 80 gm,160 gm 10,10, Prachand 40 ml,160 ml 10,10, Fantac Plus 25 ml,1 ltr 10,10, Marvex 150 ml,900 ml 10,10";
    const result = parseProduct1Name(input);

    assert.equal(result.length, 8);
    assert.equal(result[0].productName, "Blitz");
    assert.equal(result[0].skuSize, "80 gm");
    assert.equal(result[0].quantity, 10);

    assert.equal(result[1].productName, "Blitz");
    assert.equal(result[1].skuSize, "160 gm");
    assert.equal(result[1].quantity, 10);

    assert.equal(result[2].productName, "Prachand");
    assert.equal(result[2].skuSize, "40 ml");
    assert.equal(result[2].quantity, 10);

    assert.equal(result[3].productName, "Prachand");
    assert.equal(result[3].skuSize, "160 ml");
    assert.equal(result[3].quantity, 10);
  });

  test("verifies live CSV dataset has zero phantom products and 100% catalog coverage", () => {
    const orders = readOrdersCSV();
    assert.ok(orders.length > 0);

    const validProductNames = new Set(Object.keys(CPC_PRODUCT_CATALOG));
    const invalidProductNames = new Set<string>();

    for (const order of orders) {
      for (const item of order.lineItems) {
        if (!validProductNames.has(item.productName)) {
          invalidProductNames.add(item.productName);
        }
      }
    }

    assert.equal(
      invalidProductNames.size,
      0,
      `Found invalid phantom products: ${Array.from(invalidProductNames).join(", ")}`
    );
  });
});
