import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
    CognitoIdentityProviderClient,
    CreateGroupCommand,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    CreateUserPoolCommand,
    CreateUserPoolClientCommand,
    SignUpCommand,
    CreateUserPoolDomainCommand,
    // CreateUserPoolDomainCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import { Route53Client, ChangeResourceRecordSetsCommand } from '@aws-sdk/client-route-53';
import { CloudFrontClient, UpdateDistributionCommand, GetDistributionConfigCommand } from '@aws-sdk/client-cloudfront';
const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
});
export const create_tenant_admin_user = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let response: APIGatewayProxyResult;
    try {
        let app_client_id, user_pool_id;
        const tenant_user_pool_id = process.env.TENANT_USER_POOL_ID,
            tenant_app_client_id = process.env.TENANT_APP_CLIENT_ID,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            tenant_details = JSON.parse(event.body!),
            tenant_id = tenant_details.tenantId;
        const user_mget = new UserManagement();

        // if (tenant_details.dedicatedTenancy === true) {
        //     const user_pool_response = await user_mget.create_user_pool(tenant_id);
        //     user_pool_id = user_pool_response['UserPool']['Id'];
        //     console.info(user_pool_id);

        //     const app_client_response = await user_mget.create_user_pool_client(user_pool_id);
        //     console.info(app_client_response);
        //     app_client_id = app_client_response['UserPoolClient']['ClientId'];
        //     await user_mget.create_user_pool_domain(user_pool_id, tenant_id);

        //     console.info('New Tenant Created');
        // } else {
        //     user_pool_id = tenant_user_pool_id;
        //     app_client_id = tenant_app_client_id;
        // }
        // const tenant_user_group_response = await user_mget.create_user_group(
        //     user_pool_id,
        //     tenant_id,
        //     `User group for tenant ${tenant_id}`,
        // );
        // const tenant_admin_user_name = `tenant-admin-${tenant_details.tenantId}`;
        // await user_mget.tenant_signUp(app_client_id, tenant_admin_user_name, tenant_details);
        // await user_mget.add_user_to_group(
        //     user_pool_id,
        //     tenant_admin_user_name,
        //     tenant_user_group_response['Group']['GroupName'],
        // );

        const s = await user_mget.create_sub_domain(tenant_details.website);
        // console.log('afterddddd:', s);
        const body = {
            userPoolId: 'user_pool_id',
            appClientId: 'app_client_id',
            tenantAdminUserName: 'tenant_user_group_response',
        };

        response = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Headers':
                    'Content-Type, Origin, X-Requested-With, Accept, Authorization, Access-Control-Allow-Methods, Access-Control-Allow-Headers, Access-Control-Allow-Origin',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT',
            },
            body: JSON.stringify(body),
        };
    } catch (err: unknown) {
        console.log('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekkkk', err);
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

class UserManagement {
    create_user_pool(tenant_id: string) {
        const application_site_url = process.env.TENANT_USER_POOL_CALLBACK_URL,
            email_message = `Login into tenant UI application at ${application_site_url} with username {username} and temporary password {####}`,
            email_subject = 'Your temporary password for tenant UI application';
        const command = new CreateUserPoolCommand({
            PoolName: `${tenant_id}-ServerlessSaaSUserPool`,
            AutoVerifiedAttributes: ['email'],
            AccountRecoverySetting: {
                RecoveryMechanisms: [
                    {
                        Priority: 1,
                        Name: 'verified_email',
                    },
                ],
            },
            AliasAttributes: ['email'],
            Schema: [
                {
                    Name: 'email',
                    AttributeDataType: 'String',
                    Required: true,
                },
                {
                    Name: 'name',
                    Required: true,
                },
                {
                    Name: 'family_name',
                    Required: true,
                },
                {
                    Name: 'website',
                    Required: true,
                },
                {
                    Name: 'tenantId',
                    AttributeDataType: 'String',
                    Required: false,
                },
                {
                    Name: 'userRole',
                    AttributeDataType: 'String',
                    Required: false,
                },
            ],
            AdminCreateUserConfig: {
                InviteMessageTemplate: {
                    EmailMessage: email_message,
                    EmailSubject: email_subject,
                },
            },
        });

        const response = client.send(command);
        return response;
    }
    create_user_pool_client(user_pool_id: string) {
        const user_pool_callback_url = process.env.TENANT_USER_POOL_CALLBACK_URL;
        const command = new CreateUserPoolClientCommand({
            UserPoolId: user_pool_id,
            ClientName: 'ServerlessSaaSClient',
            GenerateSecret: false,
            AllowedOAuthFlowsUserPoolClient: true,
            AllowedOAuthFlows: ['code', 'implicit'],
            SupportedIdentityProviders: ['COGNITO'],
            CallbackURLs: [user_pool_callback_url],
            LogoutURLs: [user_pool_callback_url],
            AllowedOAuthScopes: ['email', 'openid', 'profile'],
            WriteAttributes: ['email', 'custom:tenantId'],
        });

        const response = client.send(command);
        return response;
    }
    create_user_group(user_pool_id: string, group_name: string, group_description: string) {
        console.log(process.env.TENANT_USER_POOL_ID, 'try');
        const command = new CreateGroupCommand({
            GroupName: group_name,
            UserPoolId: user_pool_id,
            Description: group_description,
            Precedence: 0,
        });

        const response = client.send(command);
        return response;
    }
    create_user_pool_domain(user_pool_id: string, tenant_id: string) {
        const user_pool_callback_url = process.env.TENANT_USER_POOL_CALLBACK_URL;
        const command = new CreateUserPoolDomainCommand({
            Domain: tenant_id + '-serverlesssaas',
            UserPoolId: user_pool_id,
        });

        const response = client.send(command);
        return response;
    }

    async tenant_signUp(app_client_id: string, tenant_admin_user_name: string, user_details: { [x: string]: unknown }) {
        console.log('user_details', user_details);
        const command = new SignUpCommand({
            ClientId: app_client_id,
            Username: tenant_admin_user_name,
            Password: user_details.password,
            UserAttributes: [
                { Name: 'email', Value: user_details.email },
                // {
                //     Name: 'email_verified',
                //     Value: 'true',
                // },
                { Name: 'name', Value: user_details.name },
                { Name: 'family_name', Value: user_details.family_name },
                { Name: 'website', Value: user_details.website },
                { Name: 'phone_number', Value: user_details.phone_number },
                // { Name: 'phone_number_verified', Value: 'true' },
                { Name: 'custom:userRole', Value: 'TenantAdmin' },
                { Name: 'custom:tenantId', Value: user_details.tenantId },
                { Name: 'custom:tenantTier', Value: user_details.tenantTier },
                { Name: 'custom:apiKey', Value: user_details.apiKey },
            ],
        });
        const response = await client.send(command);
        console.log('resres', response);

        return response;
    }

    create_tenant_admin(user_pool_id: string, tenant_admin_user_name: string, user_details: { [x: string]: unknown }) {
        const command = new AdminCreateUserCommand({
            Username: tenant_admin_user_name,
            UserPoolId: user_pool_id,
            ForceAliasCreation: true,
            UserAttributes: [
                { Name: 'email', Value: user_details.email },
                { Name: 'name', Value: user_details.name },
                { Name: 'family_name', Value: user_details.family_name },
                { Name: 'website', Value: user_details.website },
                { Name: 'phone_number', Value: user_details.contact },
                {
                    Name: 'phone_number_verified',
                    Value: 'true',
                },
                {
                    Name: 'email_verified',
                    Value: 'true',
                },
                {
                    Name: 'custom:userRole',
                    Value: 'TenantAdmin',
                },
                {
                    Name: 'custom:tenantId',
                    Value: user_details['tenantId'],
                },
                {
                    Name: 'custom:tenantTier',
                    Value: user_details['tenantTier'],
                },
                {
                    Name: 'custom:apiKey',
                    Value: user_details['apiKey'],
                },
            ],
        });
        const response = client.send(command);

        return response;
    }

    add_user_to_group(user_pool_id: string, user_name: string, group_name: string) {
        const command = new AdminAddUserToGroupCommand({
            UserPoolId: user_pool_id,
            Username: user_name,
            GroupName: group_name,
        });
        const response = client.send(command);
        return response;
    }
    async create_sub_domain(subdomain: string) {
        const clientRoute53 = new Route53Client({ region: process.env.AWS_REGION });
        const clientCloudFront = new CloudFrontClient({ region: process.env.AWS_REGION });

        const responseGetConfig = await this.getDistributionConfig({ Id: 'E3L5UGOX9KCQVX' }, clientCloudFront);
        const responseUpdateConfig = this.updateDistributionConfig(
            'E3L5UGOX9KCQVX',
            subdomain,
            clientCloudFront,
            responseGetConfig,
        );

        const command = new ChangeResourceRecordSetsCommand({
            HostedZoneId: 'Z10242352A3EVSL6ALCXI',
            ChangeBatch: {
                Comment: 'Creating Alias resource record sets in Route 53',
                Changes: [
                    {
                        Action: 'CREATE',
                        ResourceRecordSet: {
                            Name: subdomain,
                            Type: 'A',
                            AliasTarget: {
                                HostedZoneId: 'Z10242352A3EVSL6ALCXI',
                                DNSName: 'testing.systemha.com',
                                EvaluateTargetHealth: false,
                            },
                        },
                    },
                ],
            },
        });

        console.log('a7f', command);
        console.log('clientRoute53', clientRoute53);

        const response = clientRoute53.send(command);
        console.log('a2f', response);

        return response;
    }

    private async getDistributionConfig(config: { Id: string }, client: CloudFrontClient) {
        const command = new GetDistributionConfigCommand(config);
        const response = await client.send(command);
        return response;
    }

    private async updateDistributionConfig(Id: string, subdomain: string, client: CloudFrontClient, config: any) {
        console.log('configconfig:', config);
        const ETag = config.ETag;
        // config.ETag = undefined;
        // config.Id = Id;
        // config.IfMatch = config.ETag;
        config.DistributionConfig.Aliases.Items.push(subdomain);
        config.DistributionConfig.Aliases.Quantity = config.DistributionConfig.Aliases.Items.length;
        const command = new UpdateDistributionCommand({
            DistributionConfig: config.DistributionConfig,
            IfMatch: ETag,
            Id: Id,
        });
        const response = await client.send(command);
        return response;
    }
    // create_user_tenant_mapping(user_name, tenant_id) {
    //   response = table_tenant_user_map.put_item(
    //     (Item = {
    //       tenantId: tenant_id,
    //       userName: user_name,
    //     })
    //   );

    //   return response;
    // }
}
