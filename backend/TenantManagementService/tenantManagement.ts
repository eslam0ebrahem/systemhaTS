import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const create_tenant = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let response: APIGatewayProxyResult;
    try {
        response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'hello world',
                event: event,
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