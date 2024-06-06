import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class TypeTaskStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'public-subnet1',
          cidrMask: 24,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private-subnet1',
          cidrMask: 24,
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        }
      ]
    });
    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: vpc,
    });

    // Create a security group for the ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Allow HTTP traffic to ALB',
    });

    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from anywhere');
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });


    const container = taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'ecs' }),
    });

    // Create a security group for the ECS service
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true,
    });
    serviceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8080), 'Allow traffic from ALB');

    const service = new ecs.FargateService(this, 'FargateService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT },
      securityGroups: [serviceSecurityGroup],
    });

    // Map container port 8080 to host port 8080
    container.addPortMappings({
      containerPort: 8080,
    });

    // Create the ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // Add a listener to the ALB
    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
    });

    // Add the ECS service as a target to the listener
    listener.addTargets('ECS', {
      port: 8080,
      targets: [service],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });

    // Output the ALB DNS name
    new cdk.CfnOutput(this, 'ALBDnsName', {
      value: alb.loadBalancerDnsName,
    });
  }
}

