import type { SelectSamples, SelectSamplesCallback, RxComponentCallbacks } from "./sjpp-types";

export interface MatrixProps {
  chartType: "matrix" | "hierCluster";
  basepath?: string;
  /** Draws on this filter instead of the selected cohort, so the chart keeps its own. */
  filter0Override?: object;
  /** How many genes to show. Defaults to 50 for OncoMatrix and to 1000 for clustering. */
  maxGenes?: number;
  /** Clustering only: skips the start screen and draws straight away, from `genes` or the top genes. */
  generateTopGenes?: boolean;
  /** Clustering only: the genes to draw, instead of the top variably expressed genes. */
  genes?: ReadonlyArray<string>;
}

export interface MatrixArg {
  dslabel?: string,
  genes?: ReadonlyArray<string>,
  holder?: HTMLElement;
  noheader?: boolean;
  nobox?: boolean;
  hide_dsHandles?: boolean;
  host: string;
  launchGdcMatrix: boolean;
  launchGdcHierCluster: boolean;
  filter0?: any; //FilterSet;
  opts: MatrixArgOpts;
  state?: any;
  settings: {
    [key: string]: any
  }
}

interface MatrixArgOpts {
  app: MatrixArgOptsApp;
  matrix?: MatrixArgOptsMatrix;
  hierCluster?: MatrixArgOptsMatrix;
  geneset?: { showEditUI?: boolean }
}

interface MatrixArgOptsApp {
  callbacks?: RxComponentCallbacks;
}

interface MatrixArgOptsMatrix {
  allow2selectSamples?: SelectSamples;
  callbacks?: RxComponentCallbacks;
  customInputs?: {
    geneset?: {
      label: string;
      showInput: () => void;
    }[];
  };
}

export function getMatrixTrack(
  props: MatrixProps,
  defaultBasepath: string,
  callback?: SelectSamplesCallback,
  matrixCallbacks?: RxComponentCallbacks,
  appCallbacks?: RxComponentCallbacks,
  //genesetCallback?: () => void,
): MatrixArg {
  const arg: MatrixArg = {
    dslabel: 'MMRF',
    // genes: ['MYC', 'MYCN', 'NSD2', 'KRAS'],
    // host in gdc is just a relative url path,
    // using the same domain as the GDC portal where PP is embedded
    host: props.basepath || defaultBasepath,
    launchGdcMatrix: props.chartType == "matrix",
    launchGdcHierCluster: props.chartType == "hierCluster",
    settings: {
      matrix: {
        maxGenes: props.maxGenes ?? 50
      },
      ...(props.chartType == "hierCluster" && props.maxGenes !== undefined
        ? { hierCluster: { maxGenes: props.maxGenes } }
        : {}),
    },
    opts: {
      app: {
        callbacks: appCallbacks,
      },
      [props.chartType]: {
        allow2selectSamples: {
          buttonText: "Create cohort",
          attributes: [
            {
              from: "sample",
              to: "cases.case_id",
              convert: true,
            },
          ],
          callback,
        },
        callbacks: matrixCallbacks,
        // customInputs: {
        //   geneset: [
        //     {
        //       label: "Load Gene Sets",
        //       showInput: genesetCallback,
        //     },
        //   ],
        // },
      },
    },
  };

  if (props.genes) arg.genes = props.genes;

  if (props.chartType == "hierCluster") {
    arg.opts.geneset = {
      showEditUI: !props.generateTopGenes, // the page lets the researcher choose genes prior to clustering
    }
  }

  return arg;
}
