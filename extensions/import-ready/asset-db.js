'use strict';
exports.beforePreStart = async function beforePreStart() {
  await new Promise(resolve => setTimeout(resolve, 2000));
};
