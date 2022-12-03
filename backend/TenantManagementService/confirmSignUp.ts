import { APIGatewayProxyCallback, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ConfirmSignUpCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
export const confirmSignUp = async (event: APIGatewayProxyEvent, callback: APIGatewayProxyCallback) => {
    let response: APIGatewayProxyResult;
    try {
        // const client = new CognitoIdentityProviderClient({
        //     region: process.env.AWS_REGION,
        // });
        // const tenant_app_client_id = process.env.TENANT_APP_CLIENT_ID;
        // // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        // const tenantDetails = JSON.parse(event.body!);

        // const command = new ConfirmSignUpCommand({
        //     ClientId: tenant_app_client_id,
        //     Username: tenantDetails.username,
        //     ConfirmationCode: tenantDetails.code,
        // });
        // const body = await client.send(command);

        // response = {
        //     statusCode: 200,
        //     body: JSON.stringify({
        //         message: 'hello world',
        //         event: JSON.stringify(body),
        //     }),
        // };
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
                test: JSON.parse(event.body!),
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
