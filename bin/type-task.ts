#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TypeTaskStack } from '../lib/type-task-stack';

const app = new cdk.App();
new TypeTaskStack(app, 'TypeTaskStack');
