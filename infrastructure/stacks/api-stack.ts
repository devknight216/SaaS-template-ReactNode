import { Stack, StackProps, CfnOutput, SecretValue } from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { SubnetType, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';

import { config } from '../../app.config';
import { ApiGateway, ApiLambdaExecutionRole, Database } from '../constructs';
import { Environment } from '../../config/types';

interface ApiStackProps extends StackProps {
  name: string;
  environment: Environment;
  hostedZone: IHostedZone;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    if (!props.env || !props.env.region || !props.env.account) {
      throw new Error('Environment was not set when trying to deploy account bootstrap stack');
    }

    const { deploymentConfig, environmentVariables } = config.environments[props.environment];
    if (!deploymentConfig) {
      throw new Error(
        'Can not deploy an environment without a deployment config. Please add one to your environment in app.config.ts'
      );
    }

    const { publicDatabase, subdomain } = deploymentConfig;
    const { DB_USERNAME: dbUsername } = environmentVariables;

    // Creates a VPC that the api lambda functions will run in
    const vpc = new Vpc(this, 'ApplicationVpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 3,
      natGateways: publicDatabase ? 0 : 1,
      vpcName: `${props.name}-${props.environment}-vpc`,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          name: 'isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        {
          name: 'private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Creates a security group that the api lambda functions will be attached to.
    const apiSecurityGroup = new SecurityGroup(this, 'ApiSecurityGroup', {
      description: 'Security group for lambda funcitons',
      allowAllOutbound: true,
      vpc,
    });

    // Creates an RDS database and attaches permissions for the API to access it
    const database = new Database(this, 'RdsDatabase', {
      vpc,
      public: publicDatabase,
      username: dbUsername,
      password: SecretValue.ssmSecure(`/${props.name}/${props.environment}/DB_PASSWORD`),
      apiSecurityGroup,
    });

    // Creates a new API gateway that will proxy requests to our API lambdas
    const api = new ApiGateway(this, 'ApiGateway', {
      name: props.name,
      environment: props.environment,
      subdomain: subdomain,
      hostedZone: props.hostedZone,
    });

    // This role will be attached to the API lambdas and control what they are allowed to do in the AWS account
    const lambdaExecutionRole = new ApiLambdaExecutionRole(this, 'ApiLambdaExecutionRole', {
      name: props.name,
      environment: props.environment,
      region: props.env?.region,
      account: props.env?.account,
      publicDatabase: publicDatabase,
    });

    // Creates a new SSM parameter that the lambdas will use to know where the database is located
    new StringParameter(this, 'DbHost', {
      parameterName: `/${props.name}/${props.environment}/DB_HOST`,
      stringValue: database.endpointAddress,
    });

    // Stack outputs that can be imported by the serverless framework
    new CfnOutput(this, 'LambdaExecutionRole', { value: lambdaExecutionRole.roleArn });
    new CfnOutput(this, 'ApiSecurityGroupOutput', { value: apiSecurityGroup.securityGroupId });

    new CfnOutput(this, 'PublicSubnets', { value: vpc.publicSubnets.map((subnet) => subnet.subnetId).join(', ') });
    new CfnOutput(this, 'PrivateSubnets', {
      value: vpc.privateSubnets.map((subnet) => subnet.subnetId).join(', '),
    });
    new CfnOutput(this, 'IsolatedSubnets', {
      value: vpc.isolatedSubnets.map((subnet) => subnet.subnetId).join(', '),
    });

    new CfnOutput(this, 'ApiGatewayID', { value: api.restApiId });
    new CfnOutput(this, 'ApiGatewayRootResourceID', { value: api.rootResourceId });
    new CfnOutput(this, 'ApiDomain', { value: api.domainName });
  }
}
