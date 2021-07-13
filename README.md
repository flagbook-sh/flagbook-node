# Flagbook Javascript/Node.js SDK

![Build](https://github.com/flagbook-sh/flagbook-node/workflows/Build/badge.svg?branch=master)

The Flagbook Javascript/Node.js SDK provides convenient access to Flagbook API from application written in client-side Javascript and server-side Node.js.

## Requirements

Node 10 or higher.

## Installation

Install the package with:

```bash
npm install @flagbook/flagbook-node
```
or
```bash
yarn add @flagbook/flagbook-node
```

## Usage

Basic usage of global flag

```js
const { Flagbook } = require('@flagbook/flagbook-node')

Flagbook.init({
  accessToken: 'XXX'
})

await Flagbook.getFlagValue('user_edit_v2_enabled') // true
```
