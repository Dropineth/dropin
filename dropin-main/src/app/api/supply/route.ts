import {
    ACTIONS_CORS_HEADERS,
    ActionGetResponse,
    ActionPostRequest,
    ActionPostResponse,
    createPostResponse,
} from "@solana/actions";
import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    // clusterApiUrl,
} from "@solana/web3.js";

// GET request handler
export async function GET(request: Request) {
    const url = new URL(request.url);
    const payload: ActionGetResponse = {
        // icon: "/images/icon.png", // Local icon path
        icon: "https://s2.loli.net/2024/09/27/MeBQt4nyiT2PuzJ.jpg",
        title: "Lottery and Green",
        description: "The frist Blockchain lottery platform integrating DePin & GameFi ON SOLANA with a Climate focus",
        label: "DROPIN",
        links: {
            actions: [
                {
                    label: "Water",
                    href: `${url.href}?amount=0.1`,
                    type: "transaction"
                },
                {
                    label: "Electricity",
                    href: `${url.href}?amount=0.1`,
                    type: "transaction"
                },
                {
                    label: "Channles",
                    href: `${url.href}?amount=0.1`,
                    type: "transaction"
                },
            ],
        },
    };
    return new Response(JSON.stringify(payload), {
        headers: ACTIONS_CORS_HEADERS,
    });
}

export const OPTIONS = GET; // OPTIONS request handler

// POST request handler
export async function POST(request: Request) {
    const body: ActionPostRequest = await request.json();
    const url = new URL(request.url);
    const amount = Number(url.searchParams.get("amount")) || 0.1;
    let sender;

    try {
        sender = new PublicKey(body.account);
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: {
                    message: "Invalid account",
                },
            }),
            {
                status: 400,
                headers: ACTIONS_CORS_HEADERS,
            }
        );
    }

    const connection = new Connection("https://devnet.helius-rpc.com/?api-key=a25f7a3a-ea08-4c29-a7ff-8e34fc201be3", "confirmed");

    // const connection = new Connection(clusterApiUrl("https://devnet.helius-rpc.com/?api-key=a25f7a3a-ea08-4c29-a7ff-8e34fc201be3", "confirmed");

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: sender, // Sender public key
            toPubkey: new PublicKey("GXzEj2S7ZbhdX6FyZ58gUuUMd2cxPG2mp6TDrNshjfeR"), // Replace with your recipient public key
            lamports: amount * LAMPORTS_PER_SOL,
        })
    );
    transaction.feePayer = sender;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.lastValidBlockHeight = (await connection.getLatestBlockhash()).lastValidBlockHeight;

    const payload: ActionPostResponse = await createPostResponse({
        fields: {
            transaction,
            message: "Transaction created",
            type: "transaction"
        },

    });
    return new Response(JSON.stringify(payload), {
        headers: ACTIONS_CORS_HEADERS,
    });
}