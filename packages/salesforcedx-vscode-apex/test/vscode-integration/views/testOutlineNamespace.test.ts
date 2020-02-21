/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as events from 'events';
import * as fs from 'fs';
import { sandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { APEX_GROUP_RANGE } from '../../../src/constants';
import { ApexTestMethod } from '../../../src/views/lspConverter';
import {
  ApexTestGroupNode,
  ApexTestNode,
  ApexTestOutlineProvider
} from '../../../src/views/testOutlineProvider';
import { ApexTestRunner } from '../../../src/views/testRunner';
import { generateApexTestMethod } from './testDataUtil';
import { summaryMultipleFiles, summaryOneFile } from './testJSONOutputs';
import {
  testResultsMultipleFiles,
  testResultsOneFile
} from './testNamespacedOutputs';

const jsonOneNSFilePass = {
  summary: summaryOneFile,
  tests: testResultsOneFile
};

const jsonMultipleNSFiles = {
  summary: summaryMultipleFiles,
  tests: testResultsMultipleFiles
};

describe('Test View with namespace', () => {
  let testOutline: ApexTestOutlineProvider;
  const apexNamespacedTestInfo: ApexTestMethod[] = generateApexTestMethod(
    'tester'
  );

  describe('Get Tests and Create Tree', () => {
    it('Should create one test and one class when using namespace', () => {
      testOutline = new ApexTestOutlineProvider(
        apexNamespacedTestInfo.slice(0, 1)
      );
      if (testOutline.getHead()) {
        expect(testOutline.getHead().name).to.equal('ApexTests');
        expect(testOutline.getHead().children.length).to.equal(1);
        const testChildGroup = testOutline.getHead().children[0];
        expect(testChildGroup).instanceof(ApexTestGroupNode);
        const groupLocation = new vscode.Location(
          apexNamespacedTestInfo[0].location.uri,
          APEX_GROUP_RANGE
        );
        expect(testChildGroup.location).to.deep.equal(groupLocation);
        expect(testChildGroup.name).to.equal(
          apexNamespacedTestInfo[0].definingType
        );
        expect(testChildGroup.children.length).to.equal(1);
        const testChild = testChildGroup.children[0];
        const fullName =
          apexNamespacedTestInfo[0].definingType +
          '.' +
          apexNamespacedTestInfo[0].methodName;
        expect(testChild.name).to.deep.equal(fullName);
        expect(testChild.location).to.deep.equal(
          apexNamespacedTestInfo[0].location
        );
      }
    });

    it('Should update tests with 8 tests and 4 classes when using namespace', () => {
      testOutline = new ApexTestOutlineProvider(apexNamespacedTestInfo);
      if (testOutline.getHead()) {
        expect(testOutline.getHead().children.length).to.equal(4);
        let i = 0;
        for (const testChildGroup of testOutline.getHead().children) {
          const testInfo1 = apexNamespacedTestInfo[i];
          i++;
          const testInfo2 = apexNamespacedTestInfo[i];
          expect(testChildGroup.children.length).to.equal(2); // Each group has two children
          expect(testChildGroup.name).to.equal(testInfo1.definingType);
          const groupLocation = new vscode.Location(
            testInfo1.location.uri,
            APEX_GROUP_RANGE
          );
          expect(testChildGroup.location).to.deep.equal(groupLocation);
          // Check child test
          const test1 = testChildGroup.children[0];
          const test2 = testChildGroup.children[1];
          const fullName1 = testInfo1.definingType + '.' + testInfo1.methodName;
          const fullName2 = testInfo2.definingType + '.' + testInfo2.methodName;
          expect(test1.name).to.equal(fullName1);
          expect(test2.name).to.equal(fullName2);
          expect(test1.location).to.deep.equal(testInfo1.location);
          expect(test2.location).to.deep.equal(testInfo2.location);
          i++;
        }
      }
    });
  });

  describe('Read JSON file and update tests', () => {
    let readFolderStub: SinonStub<
      [
        fs.PathLike,
        (string | { encoding?: string | null | undefined } | null | undefined)?
      ],
      string[] | Buffer[]
    >;
    let readFileStub: SinonStub<any[], any>;
    let parseJSONStub: SinonStub<any[], any>;
    let sb: SinonSandbox;

    beforeEach(() => {
      sb = sandbox.create();
      readFolderStub = sb.stub(fs, 'readdirSync');
      readFolderStub.callsFake(folderName => {
        return ['test-result.json'];
      });
      readFileStub = sb.stub(fs, 'readFileSync');
      readFileStub.callsFake(fileName => {
        return 'nonsense';
      });
      parseJSONStub = sb.stub(JSON, 'parse');
    });

    afterEach(() => {
      sb.restore();
    });

    it('Should update single test with Pass result', () => {
      parseJSONStub.callsFake(() => {
        return jsonOneNSFilePass;
      });
      testOutline = new ApexTestOutlineProvider(
        apexNamespacedTestInfo.slice(0, 1)
      );
      testOutline.readJSONFile('oneFilePass');
      const testGroupNode = testOutline.getHead()
        .children[0] as ApexTestGroupNode;
      expect(testGroupNode.passing).to.equal(1);
      const testNode = testGroupNode.children[0] as ApexTestNode;
      expect(testNode.outcome).to.equal('Pass');
    });

    it('Should update tests and test groups with 8 results, 6 passing and 2 failing', () => {
      parseJSONStub.callsFake(() => {
        return jsonMultipleNSFiles;
      });
      testOutline = new ApexTestOutlineProvider(apexNamespacedTestInfo);
      testOutline.readJSONFile('multipleFilesMixed');
      let classNum = 0;
      expect(testOutline.getHead().children.length).to.equal(4);
      for (const testGroupNode of testOutline.getHead().children) {
        let outcome = 'Pass';
        if (classNum === 0 || classNum === 3) {
          // Failing Class
          expect((testGroupNode as ApexTestGroupNode).passing).to.equal(1);
          let testNode = testGroupNode.children[0] as ApexTestNode;
          if (classNum === 3) {
            // Tests 1 and 6 fail
            outcome = 'Fail';
          }
          expect(testNode.outcome).to.equal(outcome);
          outcome = 'Pass';
          testNode = testGroupNode.children[1] as ApexTestNode;
          if (classNum === 0) {
            // Tests 1 and 6 fail
            outcome = 'Fail';
          }
          expect(testNode.outcome).to.equal(outcome);
        } else {
          // Passing class
          expect((testGroupNode as ApexTestGroupNode).passing).to.equal(2);
          let testNode = testGroupNode.children[0] as ApexTestNode;
          expect(testNode.outcome).to.equal(outcome);
          testNode = testGroupNode.children[1] as ApexTestNode;
          expect(testNode.outcome).to.equal(outcome);
        }
        classNum++;
      }
    });
  });

  describe('Navigate to test definition or error', () => {
    let readFolderStub: SinonStub<
      [
        fs.PathLike,
        (string | { encoding?: string | null | undefined } | null | undefined)?
      ],
      string[] | Buffer[]
    >;
    let readFileStub: SinonStub<any[], any>;
    let parseJSONStub: SinonStub<any[], any>;
    let showTextDocumentStub: SinonStub<
      [vscode.Uri, (vscode.TextDocumentShowOptions | undefined)?],
      Thenable<vscode.TextEditor | void>
    >;
    let eventEmitterStub: SinonStub<[string | symbol, ...any[]], boolean>;
    let sb: SinonSandbox;
    let testRunner: ApexTestRunner;
    const eventEmitter = new events.EventEmitter();

    beforeEach(() => {
      sb = sandbox.create();
      readFolderStub = sb.stub(fs, 'readdirSync');
      readFolderStub.callsFake(folderName => ['test-result.json']);
      readFileStub = sb.stub(fs, 'readFileSync');
      readFileStub.callsFake(fileName => 'nonsense');
      parseJSONStub = sb.stub(JSON, 'parse');
      parseJSONStub.callsFake(() => jsonMultipleNSFiles);
      eventEmitterStub = sb.stub(eventEmitter, 'emit');
      showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
      showTextDocumentStub.returns(Promise.resolve());

      testOutline = new ApexTestOutlineProvider(apexNamespacedTestInfo);
      testOutline.readJSONFile('multipleFilesMixed');
      testRunner = new ApexTestRunner(testOutline, eventEmitter);
    });

    afterEach(() => {
      sb.restore();
    });

    it('Should go to definition if a test does not have an error message', async () => {
      const testNode = new ApexTestNode(
        'sampleTest',
        apexNamespacedTestInfo[0].location
      );
      const testRange = testNode.location!.range;

      await testRunner.showErrorMessage(testNode);

      // make sure we emit the update_selection event with the correct position
      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal([
        'sfdx:update_selection',
        testRange
      ]);
    });

    it('Should go to error if a test has one', async () => {
      const lineFailure = 22;
      const testNode = new ApexTestNode(
        'failedTest',
        apexNamespacedTestInfo[0].location
      );
      testNode.errorMessage = 'System.AssertException: Assertion Failed';
      testNode.stackTrace = `Class.fakeClass.test0: line ${lineFailure}, column 1`;

      await testRunner.showErrorMessage(testNode);

      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal([
        'sfdx:update_selection',
        lineFailure - 1
      ]);
    });

    it('Should go to error of first failing test in a failed test class', async () => {
      const testClass = testOutline.getHead().children[0] as ApexTestGroupNode;
      const lineFailure = 40; // first failure in testJSONOutputs.testResultsMultipleFiles

      await testRunner.showErrorMessage(testClass);

      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal([
        'sfdx:update_selection',
        lineFailure - 1
      ]);
    });
  });
});
