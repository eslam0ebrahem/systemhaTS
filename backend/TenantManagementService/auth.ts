import { APIGatewayProxyCallback, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
const { CognitoJwtVerifier } = require('aws-jwt-verify');
const {
    CognitoIdentityProviderClient,
    AdminInitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
export const signIn = async (event: APIGatewayProxyEvent, callback: APIGatewayProxyCallback) => {
    let response: APIGatewayProxyResult;
    const userDetails = JSON.parse(event.body!);
    const params = {
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        ClientId: 'jp94jd0eu5ugfb1qvn27kkslv',
        UserPoolId: 'us-east-1_Q8n90zfNi',
        AuthParameters: {
            USERNAME: userDetails.username,
            PASSWORD: userDetails.password,
        },
    };
    const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
    const command = new AdminInitiateAuthCommand(params);

    try {
        const responseAuth = await client.send(command);
        const userData = await awsDemo(params, responseAuth.AuthenticationResult.IdToken);

        response = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Headers':
                    'Content-Type, Origin, X-Requested-With, Accept, Authorization, Access-Control-Allow-Methods, Access-Control-Allow-Headers, Access-Control-Allow-Origin',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT',
            },
            body: JSON.stringify({
                message: 'Tenant Provisioning Started',
                userData: JSON.parse(userData),
            }),
        };
    } catch (err: unknown) {
        console.log(err);
        response = {
            statusCode: 500,
            body: JSON.stringify({
                message: err instanceof Error ? err.message : 'some error happened',
            }),
        };
    }

    return response;
};

function awsDemo(
    params: {
        AuthFlow: string;
        ClientId: string;
        UserPoolId: string;
        AuthParameters: { USERNAME: string; PASSWORD: string };
    },
    token: string,
) {
    const verifier = CognitoJwtVerifier.create({
        userPoolId: params.UserPoolId,
        tokenUse: 'id',
        clientId: params.ClientId,
    });

    return verifier.verify(token);
}

// async function awsdemo(userPoolId, clientId, Token) {
//     // Verifier that expects valid access tokens:
//     const verifier = CognitoJwtVerifier.create({
//         userPoolId: userPoolId,
//         tokenUse: 'id',
//         clientId: clientId,
//     });

//     try {
//         const payload = await verifier.verify(Token);
//         return payload;
//     } catch {
//         // console.log("Token not valid!");
//         return 'not valid';
//     }
// }

// exports.handler = async (event, context) => {
//     try {
//         const response = await client.send(command);
//         const userData = await awsdemo(params.UserPoolId, params.ClientId, response.AuthenticationResult.IdToken);
//         return {
//             statusCode: 200,
//             headers: {
//                 'Access-Control-Allow-Headers':
//                     'Content-Type, Origin, X-Requested-With, Accept, Authorization, Access-Control-Allow-Methods, Access-Control-Allow-Headers, Access-Control-Allow-Origin',
//                 'Access-Control-Allow-Origin': '*',
//                 'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT',
//             },
//             body: JSON.stringify(userData),
//         };
//     } catch (e) {
//         return e.message;
//     }
// };
