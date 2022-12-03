import { CodePipelineClient, StartPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';
// import { CloudFormationClient, ActivateTypeCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, BatchExecuteStatementCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const tenant_stack_mapping_table_name = process.env.TENANT_STACK_MAPPING_TABLE_NAME,
    region = process.env.AWS_REGION,
    ddbClient = new DynamoDBClient({ region: region }),
    ddbDocClient = DynamoDBDocumentClient.from(ddbClient),
    clientCodepipeline = new CodePipelineClient({ region });
export const provision_tenant = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let response: APIGatewayProxyResult;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tenant_details = JSON.parse(event.body!);

    try {
        await ddbDocClient.send(
            new PutCommand({
                TableName: tenant_stack_mapping_table_name,
                Item: {
                    tenantId: tenant_details['tenantId'],
                    stackName: `stack-${tenant_details.tenantId}`,
                    applyLatestRelease: True,
                    codeCommitId: '',
                },
            }),
        );
        const pipelineExecutionCommand = new StartPipelineExecutionCommand({
            name: 'serverless-saas-pipeline',
        });

        await clientCodepipeline.send(pipelineExecutionCommand);

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

export const deprovision_tenant = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let response: APIGatewayProxyResult;
    try {
        response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'deprovision_tenant',
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
