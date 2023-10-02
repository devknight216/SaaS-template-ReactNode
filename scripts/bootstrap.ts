#!/usr/bin/env -S npx tsx
import 'zx/globals';
import inquirer, { Answers } from 'inquirer';
import ejs from 'ejs';

const defaultValues = {
  githubRepo: 'my-github-repo',
  githubOrg: 'my-github-org',
  environments: {
    staging: {
      domain: 'staging.myapp.com',
      publicDatabase: true,
      awsAccount: '000000000000',
      awsRegion: 'us-east-1',
    },
    production: {
      domain: 'myapp.com',
      publicDatabase: true,
      awsAccount: '000000000000',
      awsRegion: 'us-east-1',
    },
  },
};

const defaultQuestions = [
  {
    type: 'string',
    name: 'name',
    message: 'What would you like to call your project?',
    default: 'volca',
  },
  {
    type: 'confirm',
    name: 'setupGithub',
    message: 'Have you created a GitHub repository for your project?',
  },
  {
    type: 'string',
    name: 'githubOrg',
    message: 'Enter your GitHub username or organization name',
    when: (answers: Answers) => answers.setupGithub,
  },
  {
    type: 'string',
    name: 'githubRepo',
    message: 'Enter your GitHub repository name',
    when: (answers: Answers) => answers.setupGithub,
  },
  {
    type: 'string',
    name: 'fromEmail',
    message: 'What email should be used as the "from" address when sending emails to your customers?',
    default: 'noreply@example.com',
  },
  {
    type: 'confirm',
    name: 'setupEnvironments',
    message: 'Would you like to configure environments to deploy to? You can always configure this later.',
  },
];

const run = async () => {
  const defaultAnswers = await inquirer.prompt(defaultQuestions);

  if (defaultAnswers.setupEnvironments) {
    defaultAnswers.environments = {};
    for (const env of ['staging', 'production']) {
      const environmentAnswers = await inquirer.prompt([
        {
          type: 'string',
          name: 'domain',
          message: `What domain would you like to use for your ${env} environment?`,
          default: env === 'production' ? 'example.com' : `${env}.example.com`,
        },
        {
          type: 'string',
          name: 'awsAccount',
          message: `What aws account should ${env} be deployed to?`,
          default: 123456789123,
        },
        {
          type: 'string',
          name: 'awsRegion',
          message: `What AWS region should ${env} be deployed to?`,
          default: 'us-east-1',
        },
        {
          type: 'confirm',
          name: 'publicDatabase',
          message: `Should the database be public in ${env}? Not recommended for production environments with real customer data. If setting this to false some extra infrastructure will be created that will cost around $30 per month.`,
          default: env !== 'production',
        },
      ]);
      defaultAnswers.environments[env] = environmentAnswers;
    }
  }

  console.log('Generating config...');

  const volcaConfigContent = await ejs.renderFile(path.join(__dirname, '../templates/config.ejs'), {
    ...defaultValues,
    ...defaultAnswers,
  });
  fs.writeFileSync(path.join(__dirname, '../app.config.ts'), volcaConfigContent);

  console.log('Done!');

  console.log('Lets set up your local environment');
  console.log(
    'To collect payments you will need to set up a Stripe account. Check out this page for more information on how to configure Stripe: https://volca.io/docs/configure-stripe/'
  );

  const localEnvAnswers = await inquirer.prompt([
    {
      type: 'string',
      name: 'stripePriceId',
      message: `Enter your stripe test price ID for customer subscriptions, starting with "price_.."`,
    },
    {
      type: 'string',
      name: 'stripeKey',
      message: `Enter your stripe test key, starting with "sk_test.."`,
    },
  ]);

  console.log('Writing local config..');

  const dotenvFileContent = await ejs.renderFile(path.join(__dirname, '../templates/.env.ejs'), {
    ...localEnvAnswers,
    fromEmail: defaultAnswers.fromEmail,
  });
  fs.writeFileSync(path.join(__dirname, '../.env'), dotenvFileContent);

  console.log('Done!');
};

console.log("Welcome to Volca! Let's set up a new project.");

run();
