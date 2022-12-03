import {
    // APIGatewayProxyEvent,
    APIGatewayAuthorizerEvent,
    APIGatewayProxyResult,
    APIGatewayEventRequestContext,
    APIGatewayProxyCallback,
    APIGatewayProxyEvent,
} from 'aws-lambda';
import CognitoExpress from 'cognito-express';

const region = process.env.AWS_REGION,
    userPoolId = process.env.TENANT_USER_POOL,
    appClientId = process.env.TENANT_APP_CLIENT;

const cognitoExpress = new CognitoExpress({
    region: region,
    CognitoUserPoolId: userPoolId,
    tokenUse: 'id', //Possible Values: access | id
    tokenExpiration: 3600, //Up to default expiration of 1 hour (3600000 ms)
});
// exports.lambda_handler = async (event, context, callback) => {

export const lambda_handler = async (
    event: { authorizationToken: string; methodArn: string },
    callback: APIGatewayProxyCallback,
) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const token = event.authorizationToken.split(' ');
    const jwt_bearer_token = token[1];
    try {
        const responseToken = await cognitoExpress.validate(jwt_bearer_token);
        console.info('Token:', responseToken);
        const principal_id = responseToken.sub,
            user_name = responseToken['cognito:username'],
            tenant_id = responseToken['custom:tenantId'],
            user_role = responseToken['custom:userRole'];

        const tmp = event.methodArn.split(':');
        const api_gateway_arn_tmp = tmp[5].split('/');
        const aws_account_id = tmp[4];
        const policy = new AuthPolicy(principal_id, aws_account_id);
        policy.restApiId = api_gateway_arn_tmp[0];
        policy.region = tmp[3];
        policy.stage = api_gateway_arn_tmp[1];
        // if (user_role != "SystemAdmin" && user_role != "CustomerSupport")
        //   if (
        //     isTenantAuthorizedForThisAPI(apigateway_url, api_gateway_arn_tmp[0]) ==
        //     False
        //   )
        //     callback("Unauthorized");
        // console.log(principal_id, user_name, tenant_id);

        policy.allowAllMethods();

        const authResponse = policy.build();

        //  Generate STS credentials to be used for FGAC

        //  Important Note:
        //  We are generating STS token inside Authorizer to take advantage of the caching behavior of authorizer
        //  Another option is to generate the STS token inside the lambda function itself, as mentioned in this blog post: https://aws.amazon.com/blogs/apn/isolating-saas-tenants-with-dynamically-generated-iam-policies/
        //  Finally, you can also consider creating one Authorizer per microservice in cases where you want the IAM policy specific to that service

        // const iam_policy = auth_manager.getPolicyForUser(
        //   user_role,
        //   utils.Service_Identifier.BUSINESS_SERVICES.value,
        //   tenant_id,
        //   region,
        //   aws_account_id
        // );
        // console.info(iam_policy);

        // const role_arn = `arn:aws:iam::${aws_account_id}:role/authorizer-access-role`;

        // assumed_role = sts_client.assume_role(
        //   (RoleArn = role_arn),
        //   (RoleSessionName = "tenant-aware-session"),
        //   (Policy = iam_policy)
        // );
        // credentials = assumed_role["Credentials"];
        // // pass sts credentials to lambda
        // context = {
        //   accesskey: credentials["AccessKeyId"], // $context.authorizer.key -> value
        //   secretkey: credentials["SecretAccessKey"],
        //   sessiontoken: credentials["SessionToken"],
        // 'userName': user_name,
        // 'tenantId': tenant_id,
        // 'userPoolId': userPoolId,
        // 'apiKey': api_key,
        // 'userRole': user_role
        // };

        // authResponse["context"] = context;
        console.log('authResponse:', authResponse);
        const gg = generatePolicy('user', 'Allow', event.methodArn);
        console.log('generatePolicy:', gg);
        return gg;
    } catch (err: unknown) {
        console.log(err);
        console.warn('Token:', err);
        // throw new Error("Unauthorized");
        callback('Unauthorized');
    }
};

// Help function to generate an IAM policy
const generatePolicy = function (principalId: string, effect: string, resource: unknown) {
    const authResponse = { principalId, policyDocument: {}, context: {} };
    if (effect && resource) {
        const statementOne = { Action: 'execute-api:Invoke', Effect: effect, Resource: resource };
        const policyDocument = {
            Version: '2012-10-17',
            Statement: [statementOne],
        };
        authResponse.policyDocument = policyDocument;
    }

    // Optional output with custom properties of the String, Number or Boolean type.
    authResponse.context = {
        stringKey: 'stringval',
        numberKey: 123,
        booleanKey: true,
    };
    return authResponse;
};

const HttpVerb = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    HEAD: 'HEAD',
    DELETE: 'DELETE',
    OPTIONS: 'OPTIONS',
    ALL: '*',
};

class AuthPolicy {
    awsAccountId = '';

    principalId = '';

    version = '2012-10-17';

    pathRegex = /^[/.a-zA-Z0-9-*]+$/g;

    allowMethods: { resourceArn: string; conditions: string[] }[] = [];
    denyMethods: { resourceArn: string; conditions: string[] }[] = [];

    restApiId = '*';

    region = '*';

    stage = '*';

    constructor(principal: string, awsAccountId: string) {
        this.awsAccountId = awsAccountId;
        this.principalId = principal;
        this.allowMethods = [];
        this.denyMethods = [];
    }
    addMethod(effect: string, verb: string, resource: string, conditions: string[]) {
        // console.log(effect, verb, resource, conditions, HttpVerb[verb], verb !== '*', !HttpVerb[verb]);
        if (verb !== '*' && !HttpVerb[verb as keyof typeof HttpVerb])
            throw new Error(`Invalid HTTP verb ${verb}. Allowed verbs in HttpVerb class`);
        if (!resource.match(this.pathRegex))
            throw new Error(`Invalid resource path: ${resource}. Path should match ${this.pathRegex}`);
        if (resource.substr(0, resource.length - 1) == '/') resource = resource.substr(1);
        const resourceArn = `arn:aws:execute-api:${this.region}:${this.awsAccountId}:${this.restApiId}/${this.stage}/${verb}/${resource}`;
        if (effect.toLowerCase() == 'allow')
            this.allowMethods.push({
                resourceArn: resourceArn,
                conditions: conditions,
            });
        else if (effect.toLowerCase() == 'deny')
            this.denyMethods.push({
                resourceArn: resourceArn,
                conditions: conditions,
            });
    }

    getEmptyStatement(effect: string) {
        // Returns an empty statement object prepopulated with the correct action and the desired effect.
        const statement = {
            Action: 'execute-api:Invoke',
            Effect: effect.substr(0, effect.length - 1).toUpperCase() + effect.substr(1).toLowerCase(),
            Resource: [] as string[],
            Condition: [] as string[],
        };
        return statement;
    }

    getStatementForEffect(effect: string, methods: { resourceArn: string; conditions: string[] }[]) {
        // This function loops over an array of objects containing a resourceArn and
        // conditions statement and generates the array of statements for the policy.
        const statements: {
            Action: string;
            Effect: string;
            Resource: string[];
            Condition: string[];
        }[] = [];

        if (methods.length > 0) {
            const statement = this.getEmptyStatement(effect);
            methods.forEach((curMethod: { resourceArn: string; conditions: string[] }) => {
                if (!curMethod.conditions || curMethod.conditions.length == 0)
                    statement.Resource.push(curMethod.resourceArn);
                else {
                    const conditionalStatement = this.getEmptyStatement(effect);
                    conditionalStatement.Resource.push(curMethod.resourceArn);
                    conditionalStatement.Condition = curMethod.conditions;
                    statements.push(conditionalStatement);
                }
            });

            statements.push(statement);
        }
        return statements;
    }

    // getStatementForEffect(effect: string, methods: string[]) {
    //     // This function loops over an array of objects containing a resourceArn and
    //     // conditions statement and generates the array of statements for the policy.
    //     const statements: unknown[] = [];

    //     if (methods.length > 0) {
    //         const statement = this.getEmptyStatement(effect);
    //         for (const curMethod in methods) {
    //             if (
    //                 !curMethod['conditions' as keyof typeof curMethod] ||
    //                 curMethod['conditions' as keyof typeof curMethod].length == 0
    //             )
    //                 statement['Resource'].push(curMethod['resourceArn' as keyof typeof curMethod]);
    //             else {
    //                 const conditionalStatement = this.getEmptyStatement(effect);
    //                 conditionalStatement['Resource' as keyof typeof conditionalStatement].push(
    //                     curMethod['resourceArn' as keyof typeof curMethod],
    //                 );
    //                 conditionalStatement['Condition' as keyof typeof conditionalStatement] =
    //                     curMethod['conditions' as keyof typeof curMethod];
    //                 statements.push(conditionalStatement);
    //             }
    //         }
    //         statements.push(statement);
    //     }
    //     return statements;
    // }
    allowAllMethods() {
        // Adds a '*' allow to the policy to authorize access to all methods of an API
        this.addMethod('Allow', 'ALL', '*', []);
    }
    denyAllMethods() {
        // Adds a '*' allow to the policy to deny access to all methods of an API
        this.addMethod('Deny', 'ALL', '*', []);
    }
    allowMethod(verb: any, resource: any) {
        // Adds an API Gateway method (Http verb + Resource path) to the list of allowed
        // methods for the policy
        this.addMethod('Allow', verb, resource, []);
    }

    denyMethod(verb: any, resource: any) {
        // Adds an API Gateway method (Http verb + Resource path) to the list of denied
        // methods for the policy
        this.addMethod('Deny', verb, resource, []);
    }

    allowMethodWithConditions(verb: any, resource: any, conditions: any) {
        // Adds an API Gateway method (Http verb + Resource path) to the list of allowed
        // methods and includes a condition for the policy statement. More on AWS policy
        // conditions here: http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html#Condition
        this.addMethod('Allow', verb, resource, conditions);
    }

    denyMethodWithConditions(verb: any, resource: any, conditions: any) {
        // Adds an API Gateway method (Http verb + Resource path) to the list of denied
        // methods and includes a condition for the policy statement. More on AWS policy
        // conditions here: http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html#Condition
        this.addMethod('Deny', verb, resource, conditions);
    }

    build() {
        // Generates the policy document based on the internal lists of allowed and denied
        // conditions. This will generate a policy with two main statements for the effect:
        // one statement for Allow and one statement for Deny.
        // Methods that includes conditions will have their own statement in the policy.
        if (
            (!this.allowMethods || this.allowMethods.length == 0) &&
            (!this.denyMethods || this.denyMethods.length == 0)
        )
            throw new Error('No statements defined for the policy');

        const policy = {
            principalId: this.principalId,
            policyDocument: {
                Version: this.version,
                Statement: [
                    {
                        Action: '',
                        Effect: '',
                        Resource: [] as string[],
                        Condition: [] as string[],
                    },
                ],
            },
        };

        policy['policyDocument']['Statement'].concat(this.getStatementForEffect('Allow', this.allowMethods));
        policy['policyDocument']['Statement'].concat(this.getStatementForEffect('Deny', this.denyMethods));

        return policy;
    }
}
const isTenantAuthorizedForThisAPI = function (apigateway_url: string, current_api_id: any) {
    if (apigateway_url.split('.')[0] !== `https://${current_api_id}`) return false;
    else return true;
};
