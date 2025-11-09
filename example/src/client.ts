import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { dotAh, dotPpl } from "@polkadot-api/descriptors";
import { createIdentitySdk } from "@polkadot-api/sdk-accounts";

export const client = createClient(
  getWsProvider("wss://sys.ibp.network/asset-hub-polkadot")
);

export const dotApi = client.getTypedApi(dotAh);

const peopleClient = createClient(
  getWsProvider("wss://sys.ibp.network/people-polkadot")
);
const pplApi = peopleClient.getTypedApi(dotPpl);

export const identitySdk = createIdentitySdk(pplApi);
