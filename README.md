# Financial Flows Visualization: Marble Freedom Trust & DAF Network

This repository hosts a static web application that visually represents the major financial flows within a specific conservative funding network, focusing on the interplay between **Marble Freedom Trust (MFT)**, **DonorsTrust (DT)**, and other related donor-advised funds (DAFs) and organizations.

## Overview

The visualization is built to clarify the complex financial arteries, showing both quantified and unquantified, but verified, money movements as identified in a detailed investigative report. It aims to provide an accessible and interactive way to understand how these entities function as a unified financial powerhouse, particularly under the strategic direction of Leonard Leo.

## Features

* **Interactive Node Map:** A clear, color-coded diagram displaying key organizations (nodes) and the financial transfers (lines) between them.
* **Quantified & Unquantified Flows:** Distinct visual representation for flows with reported dollar amounts versus verified, yet unquantified, connections.
* **LLM-Powered Summaries:** Click on any organizational node (e.g., MFT, DonorsTrust) to open a modal window with a concise, AI-generated summary of that entity's role and significance within the network. This summary is derived directly from the underlying investigative report.
* **Responsive Design:** The visualization adjusts to different screen sizes, providing a good viewing experience on various devices.
* **Customizable Theme:** The background color is set to a dark, journalistic tone, easily customizable to match a blog's aesthetic.

## How to View

This is a static HTML page, so you can simply open the `index.html` file in your web browser.

Alternatively, since this repository is named `greenmovelow.github.io`, it is automatically deployed as a GitHub Pages user site. You can access it live at:

**[https://greenmovelow.github.io/](https://greenmovelow.github.io/)**

*(Please note: It may take a few minutes for GitHub Pages to deploy after pushing new commits.)*

## Data Source

The financial data, organizational relationships, and narrative context for this visualization are derived from the "Final Report: The MFT-DonorsTrust Financial Artery," a meta-journalistic investigative journalism piece. The report details primary source analysis of tax filings (e.g., MFT's Form 990) and secondary source reporting.

## Technical Details

* **HTML5:** For structuring the web page.
* **Tailwind CSS:** For responsive and utility-first styling.
* **SVG:** Used for drawing dynamic flow lines and arrowheads between nodes.
* **JavaScript:** Powers the interactive elements, node positioning, line drawing, and the integration with the Gemini API for LLM-generated summaries.
* **Gemini API:** Used to call the `gemini-2.0-flash` LLM to generate on-demand summaries of each organization based on pre-fed textual data from the report.

## Contribution / Feedback

While this is a static visualization, feedback on its clarity, accuracy (relative to the source material), or suggestions for improvements are welcome.
