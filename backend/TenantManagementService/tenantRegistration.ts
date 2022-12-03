import { v4 as uuid4 } from 'uuid';
import axios from 'axios';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    CREATE_TENANT_ADMIN_USER_RESOURCE_PATH,
    AWS_REGION,
    BASIC_TIER_API_KEY,
} = process.env;

const sigv4 = new SignatureV4({
    service: 'execute-api',
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
        sessionToken: AWS_SESSION_TOKEN,
    },
    sha256: Sha256,
});
export const registerTenant = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let response: APIGatewayProxyResult;
    try {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        console.log(event.requestContext.stage, event.headers, 'TRRRRRRRRRRRRRRRR');
        const tenantDetails = JSON.parse(event.body!),
            stageName = event.requestContext.stage,
            headers = event.headers,
            host =
                stageName === 'test-invoke-stage'
                    ? `${event.requestContext.apiId}.execute-api.${AWS_REGION}.amazonaws.com`
                    : headers.Host;
        tenantDetails.tenantId = uuid4();
        // tenantDetails.dedicatedTenancy = false;
        tenantDetails.apiKey = BASIC_TIER_API_KEY;

        const ddd = await createTenantAdminUser(tenantDetails, host);
        const createUserResponse = ddd;
        console.log('TEST RESSSSSSS', createUserResponse);
        response = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Headers':
                    'Content-Type, Origin, X-Requested-With, Accept, Authorization, Access-Control-Allow-Methods, Access-Control-Allow-Headers, Access-Control-Allow-Origin',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT',
            },
            body: JSON.stringify({
                message: createUserResponse.data,
            }),
        };
    } catch (err: unknown) {
        console.log('SSSSSSSSSSSSSSSDDDDD', err instanceof Error ? 'yes' : 'no', err);
        response = {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Headers':
                    'Content-Type, Origin, X-Requested-With, Accept, Authorization, Access-Control-Allow-Methods, Access-Control-Allow-Headers, Access-Control-Allow-Origin',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT',
            },
            body: JSON.stringify({
                message: err instanceof Error ? err.message : 'some error happened',
            }),
        };
    }
    return response;
};

async function createTenantAdminUser(tenantDetails: unknown, host: string | undefined) {
    const apiUrl = new URL(`https://${host}/${'prod'}${CREATE_TENANT_ADMIN_USER_RESOURCE_PATH}`);
    const signed = await sigv4.sign({
        method: 'POST',
        hostname: apiUrl.host,
        path: apiUrl.pathname,
        protocol: apiUrl.protocol,
        headers: {
            'Content-Type': 'application/json',
            host: apiUrl.hostname, // compulsory
        },
        body: JSON.stringify(tenantDetails),
    });

    const data = axios({
        ...signed,
        url: apiUrl.href, // compulsory
        data: JSON.stringify(tenantDetails),
    }).catch(
        (error: {
            response: { data: { message: string }; status: unknown; headers: unknown };
            request: unknown;
            message: unknown;
            config: unknown;
        }) => {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                // return Error('error.response');
                throw new Error(error.response.data.message);

                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
            } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                console.log(error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.log('Error', error.message);
            }
            console.log(error.config);
        },
    );
    return data;
}
