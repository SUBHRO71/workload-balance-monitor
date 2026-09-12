import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function createInMemoryDynamoClient(): DynamoDBDocumentClient {
  const store = new Map<string, Record<string, unknown>>();

  const keyFor = (key: { PK: string; SK: string }) => `${key.PK}###${key.SK}`;

  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const name = command.constructor.name;
      const input = command.input;

      if (name === "GetCommand") {
        const key = keyFor(input.Key as { PK: string; SK: string });
        return { Item: store.get(key) ? { ...store.get(key) } : undefined };
      }

      if (name === "PutCommand") {
        const item = input.Item as { PK: string; SK: string };
        store.set(keyFor(item), { ...item });
        return {};
      }

      if (name === "DeleteCommand") {
        const key = keyFor(input.Key as { PK: string; SK: string });
        store.delete(key);
        return {};
      }

      if (name === "QueryCommand") {
        const values = input.ExpressionAttributeValues as Record<string, string>;
        const pk = values[":pk"]!;
        const skPrefix = values[":sk"] ?? "";
        const matched: Array<Record<string, unknown>> = [];
        for (const [k, v] of store.entries()) {
          const [itemPk, itemSk] = k.split("###");
          if (itemPk === pk && itemSk?.startsWith(skPrefix)) {
            matched.push({ ...v });
          }
        }
        return { Items: matched };
      }

      if (name === "TransactWriteCommand") {
        const items = input.TransactItems as Array<{
          Put?: { Item: { PK: string; SK: string } };
          Delete?: { Key: { PK: string; SK: string } };
        }>;
        for (const entry of items) {
          if (entry.Put) {
            store.set(keyFor(entry.Put.Item), { ...entry.Put.Item });
          }
          if (entry.Delete) {
            store.delete(keyFor(entry.Delete.Key));
          }
        }
        return {};
      }

      throw new Error(`Unsupported command in mock: ${name}`);
    },
  };

  return client as unknown as DynamoDBDocumentClient;
}
